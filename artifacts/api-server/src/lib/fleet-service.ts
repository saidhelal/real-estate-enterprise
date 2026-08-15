import { and, desc, eq } from "drizzle-orm";
import {
  db,
  vehiclesTable,
  vehicleMaintenanceLogsTable,
  settingsTable,
} from "@workspace/db";
import type { Tx } from "./posting";

/**
 * When a vehicle is next due for service.
 *
 * `next_service_date` was a date somebody typed onto a maintenance log, so a
 * fleet's servicing schedule was whatever each clerk remembered — and nothing
 * looked at distance or running hours at all, though the odometer was recorded
 * on every visit.
 *
 * The approved rule, in one place:
 *
 *     due = whichever comes first of
 *             the service interval in months from the last service,
 *             the vehicle's own distance limit,
 *             the vehicle's own running-hours limit
 *
 * The months come from a setting because the period is a company policy. The
 * distance and hours come from the *vehicle*, because they belong to the
 * machine: a sedan and a generator do not share an interval, and no general
 * figure for either is invented here. A vehicle with neither limit recorded is
 * governed by the months alone, which is the honest reading of "not specified"
 * rather than a reason to guess.
 */

/** The time half of the rule. Months, from the settings registry. */
export const SERVICE_INTERVAL_MONTHS_KEY = "fleet.serviceIntervalMonths";

function num(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** The configured interval in months, or null when the policy is unset. */
export async function serviceIntervalMonths(exec: Tx | typeof db): Promise<number | null> {
  const [row] = await exec
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, SERVICE_INTERVAL_MONTHS_KEY))
    .limit(1);
  const months = num(row?.value);
  return months !== null && months > 0 ? months : null;
}

/** Add whole months to a date without drifting past the end of a short month. */
function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 August + 6 months is 28/29 February, not 3 March.
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export type DueReason = "months" | "distance" | "hours";

export interface ServiceDue {
  /** The date the next service falls due, when time is what decides it. */
  nextServiceDate: string | null;
  /** Odometer reading at which it falls due, when the vehicle has a limit. */
  dueAtOdometer: number | null;
  /** Running hours at which it falls due, when the vehicle has a limit. */
  dueAtHours: number | null;
  /** Which limit is reached first, given where the vehicle stands now. */
  reachedFirst: DueReason | null;
  /** True once any of the limits has been passed. */
  overdue: boolean;
}

/**
 * Work out the next service from a vehicle's own limits and the last service.
 *
 * Pure: it takes the facts and returns the answer, so the same arithmetic is
 * available to a screen, a report and a scheduled sweep without any of them
 * re-deriving it.
 */
export function computeServiceDue(input: {
  lastServiceDate: string | null;
  intervalMonths: number | null;
  currentOdometer: number | null;
  serviceIntervalKm: number | null;
  odometerAtLastService: number | null;
  currentHours: number | null;
  serviceIntervalHours: number | null;
  hoursAtLastService: number | null;
  today?: string;
}): ServiceDue {
  const today = input.today ?? new Date().toISOString().slice(0, 10);

  const nextServiceDate =
    input.lastServiceDate && input.intervalMonths
      ? addMonths(input.lastServiceDate, input.intervalMonths)
      : null;

  // The limits are counted from the last service, not from zero: a vehicle
  // serviced at 40,000 km with a 10,000 km interval is due at 50,000.
  const dueAtOdometer =
    input.serviceIntervalKm !== null
      ? (input.odometerAtLastService ?? 0) + input.serviceIntervalKm
      : null;
  const dueAtHours =
    input.serviceIntervalHours !== null
      ? (input.hoursAtLastService ?? 0) + input.serviceIntervalHours
      : null;

  const overdueByDate = nextServiceDate !== null && today >= nextServiceDate;
  const overdueByDistance =
    dueAtOdometer !== null && input.currentOdometer !== null && input.currentOdometer >= dueAtOdometer;
  const overdueByHours =
    dueAtHours !== null && input.currentHours !== null && input.currentHours >= dueAtHours;

  /*
   * "Whichever comes first" is decided on how much of each limit is used up,
   * not on comparing a date with a kilometre — those are not comparable. A
   * vehicle 80% through its months and 95% through its distance is due on
   * distance, which is the question a fleet manager is actually asking.
   */
  const progress: Array<{ reason: DueReason; used: number }> = [];

  if (nextServiceDate && input.lastServiceDate) {
    const span = Date.parse(nextServiceDate) - Date.parse(input.lastServiceDate);
    const done = Date.parse(today) - Date.parse(input.lastServiceDate);
    if (span > 0) progress.push({ reason: "months", used: done / span });
  }
  if (dueAtOdometer !== null && input.currentOdometer !== null && input.serviceIntervalKm) {
    const done = input.currentOdometer - (input.odometerAtLastService ?? 0);
    progress.push({ reason: "distance", used: done / input.serviceIntervalKm });
  }
  if (dueAtHours !== null && input.currentHours !== null && input.serviceIntervalHours) {
    const done = input.currentHours - (input.hoursAtLastService ?? 0);
    progress.push({ reason: "hours", used: done / input.serviceIntervalHours });
  }

  const leader = progress.sort((a, b) => b.used - a.used)[0] ?? null;

  return {
    nextServiceDate,
    dueAtOdometer,
    dueAtHours,
    reachedFirst: leader?.reason ?? null,
    overdue: overdueByDate || overdueByDistance || overdueByHours,
  };
}

/**
 * The same answer, for a vehicle that exists.
 *
 * Reads the last completed service from the maintenance log — the readings
 * taken at that visit are what the next interval counts from.
 */
export async function vehicleServiceDue(
  exec: Tx | typeof db,
  vehicleId: string,
  today?: string,
): Promise<ServiceDue | null> {
  const [vehicle] = await exec
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.id, vehicleId));
  if (!vehicle) return null;

  const [last] = await exec
    .select({
      serviceDate: vehicleMaintenanceLogsTable.serviceDate,
      odometer: vehicleMaintenanceLogsTable.odometer,
    })
    .from(vehicleMaintenanceLogsTable)
    .where(
      and(
        eq(vehicleMaintenanceLogsTable.vehicleId, vehicleId),
        eq(vehicleMaintenanceLogsTable.isDeleted, false),
        // Servicing is what resets the interval; refuelling is not a service.
        eq(vehicleMaintenanceLogsTable.logType, "service"),
      ),
    )
    .orderBy(desc(vehicleMaintenanceLogsTable.serviceDate))
    .limit(1);

  return computeServiceDue({
    lastServiceDate: last?.serviceDate ?? null,
    intervalMonths: await serviceIntervalMonths(exec),
    currentOdometer: num(vehicle.currentOdometer),
    serviceIntervalKm: num(vehicle.serviceIntervalKm),
    odometerAtLastService: num(last?.odometer),
    currentHours: num(vehicle.currentOperatingHours),
    serviceIntervalHours: num(vehicle.serviceIntervalHours),
    // Running hours are not recorded per visit, so the interval counts from
    // zero. Stated rather than hidden: it is what the data supports today.
    hoursAtLastService: null,
    today,
  });
}

/**
 * Stamp the computed due date onto a maintenance log.
 *
 * The log records what was done and when the next one falls due; the date is
 * derived rather than typed, so two clerks cannot schedule the same vehicle
 * differently. Nothing is written when the policy is unset.
 */
export async function applyNextServiceDate(tx: Tx, logId: string): Promise<string | null> {
  const [log] = await tx
    .select()
    .from(vehicleMaintenanceLogsTable)
    .where(eq(vehicleMaintenanceLogsTable.id, logId));
  if (!log || !log.vehicleId || log.logType !== "service") return null;

  const months = await serviceIntervalMonths(tx);
  if (months === null || !log.serviceDate) return null;

  const next = addMonths(log.serviceDate, months);
  await tx
    .update(vehicleMaintenanceLogsTable)
    .set({ nextServiceDate: next })
    .where(eq(vehicleMaintenanceLogsTable.id, logId));
  return next;
}
