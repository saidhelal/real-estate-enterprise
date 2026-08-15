import { describe, expect, it } from "vitest";
import { computeServiceDue } from "../src/lib/fleet-service";

/**
 * When a vehicle is next due.
 *
 * The approved rule is "six months, or the vehicle's own distance or
 * running-hours limit, whichever comes first". `next_service_date` used to be
 * a date typed onto a maintenance log, and nothing consulted the odometer at
 * all — though it was recorded at every visit.
 *
 * `computeServiceDue` is pure, so these are arithmetic on stated facts: no
 * fixtures, no database, and every expected value re-derivable from the inputs
 * in the same block.
 */

const BASE = {
  lastServiceDate: "2026-01-31",
  intervalMonths: 6,
  currentOdometer: null,
  serviceIntervalKm: null,
  odometerAtLastService: null,
  currentHours: null,
  serviceIntervalHours: null,
  hoursAtLastService: null,
};

describe("the time half of the rule", () => {
  it("falls due six months after the last service", () => {
    const due = computeServiceDue({ ...BASE, today: "2026-02-01" });
    expect(due.nextServiceDate).toBe("2026-07-31");
    expect(due.overdue).toBe(false);
  });

  it("does not drift past the end of a short month", () => {
    // 31 August + 6 months is the end of February, not the 3rd of March.
    const due = computeServiceDue({
      ...BASE,
      lastServiceDate: "2025-08-31",
      today: "2025-09-01",
    });
    expect(due.nextServiceDate).toBe("2026-02-28");
  });

  it("is overdue once the date passes", () => {
    const due = computeServiceDue({ ...BASE, today: "2026-08-01" });
    expect(due.overdue).toBe(true);
    expect(due.reachedFirst).toBe("months");
  });

  it("says nothing when the policy is unset", () => {
    // No interval configured is not "due today"; it is "no rule to apply".
    const due = computeServiceDue({ ...BASE, intervalMonths: null, today: "2026-08-01" });
    expect(due.nextServiceDate).toBeNull();
    expect(due.overdue).toBe(false);
  });
});

describe("the distance half of the rule", () => {
  it("counts from the reading at the last service, not from zero", () => {
    // Serviced at 40,000 with a 10,000 km interval -> due at 50,000.
    const due = computeServiceDue({
      ...BASE,
      odometerAtLastService: 40_000,
      serviceIntervalKm: 10_000,
      currentOdometer: 44_000,
      today: "2026-02-15",
    });
    expect(due.dueAtOdometer).toBe(50_000);
    expect(due.overdue).toBe(false);
  });

  it("is overdue once the reading passes the limit", () => {
    const due = computeServiceDue({
      ...BASE,
      odometerAtLastService: 40_000,
      serviceIntervalKm: 10_000,
      currentOdometer: 50_100,
      today: "2026-02-15",
    });
    expect(due.overdue).toBe(true);
  });

  it("has no distance limit when the vehicle records none", () => {
    // Nothing is invented for a vehicle nobody gave a limit to — the months
    // govern it alone.
    const due = computeServiceDue({ ...BASE, currentOdometer: 999_999, today: "2026-02-01" });
    expect(due.dueAtOdometer).toBeNull();
    expect(due.overdue).toBe(false);
  });
});

describe("the running-hours half of the rule", () => {
  it("falls due at the vehicle's own hours limit", () => {
    const due = computeServiceDue({
      ...BASE,
      serviceIntervalHours: 500,
      currentHours: 480,
      today: "2026-02-15",
    });
    expect(due.dueAtHours).toBe(500);
    expect(due.overdue).toBe(false);
  });

  it("is overdue once the hours pass the limit", () => {
    const due = computeServiceDue({
      ...BASE,
      serviceIntervalHours: 500,
      currentHours: 505,
      today: "2026-02-15",
    });
    expect(due.overdue).toBe(true);
    expect(due.reachedFirst).toBe("hours");
  });
});

describe("whichever comes first", () => {
  it("chooses distance when the vehicle is further through its kilometres", () => {
    // Two months of six used (33%); 9,500 of 10,000 km used (95%).
    const due = computeServiceDue({
      ...BASE,
      lastServiceDate: "2026-01-01",
      odometerAtLastService: 0,
      serviceIntervalKm: 10_000,
      currentOdometer: 9_500,
      today: "2026-03-01",
    });
    expect(due.reachedFirst).toBe("distance");
    expect(due.overdue).toBe(false);
  });

  it("chooses time when the months are further along", () => {
    // Five months of six used (83%); 1,000 of 10,000 km used (10%).
    const due = computeServiceDue({
      ...BASE,
      lastServiceDate: "2026-01-01",
      odometerAtLastService: 0,
      serviceIntervalKm: 10_000,
      currentOdometer: 1_000,
      today: "2026-06-01",
    });
    expect(due.reachedFirst).toBe("months");
  });

  it("compares how much of each limit is used, not a date against a kilometre", () => {
    // Hours 90% used beats distance 20% used and time 33% used.
    const due = computeServiceDue({
      ...BASE,
      lastServiceDate: "2026-01-01",
      odometerAtLastService: 0,
      serviceIntervalKm: 10_000,
      currentOdometer: 2_000,
      serviceIntervalHours: 500,
      currentHours: 450,
      today: "2026-03-01",
    });
    expect(due.reachedFirst).toBe("hours");
  });

  it("reports overdue when any one limit is passed, even if the others are not", () => {
    const due = computeServiceDue({
      ...BASE,
      lastServiceDate: "2026-01-01",
      odometerAtLastService: 0,
      serviceIntervalKm: 10_000,
      currentOdometer: 12_000,
      today: "2026-02-01", // only one month of six
    });
    expect(due.overdue).toBe(true);
  });
});

describe("a vehicle with no operational policy at all", () => {
  it("is governed by the months alone", () => {
    const due = computeServiceDue({ ...BASE, today: "2026-02-01" });
    expect(due.nextServiceDate).toBe("2026-07-31");
    expect(due.dueAtOdometer).toBeNull();
    expect(due.dueAtHours).toBeNull();
    expect(due.reachedFirst).toBe("months");
  });

  it("produces no schedule when it has never been serviced", () => {
    // Without a last service there is nothing to count six months from, and
    // guessing a start date would put a false date in front of a manager.
    const due = computeServiceDue({ ...BASE, lastServiceDate: null, today: "2026-02-01" });
    expect(due.nextServiceDate).toBeNull();
    expect(due.reachedFirst).toBeNull();
    expect(due.overdue).toBe(false);
  });
});
