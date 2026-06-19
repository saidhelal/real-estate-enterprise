// Data Entry Center — pure types and helpers.
//
// This module ONLY simplifies bulk data entry into the EXISTING master-data
// tables (projects, phases, buildings, floors, units) via the existing APIs.
// It intentionally contains NO sales/reservation/contract/installment logic:
// setting a unit's status simply writes the chosen unitStatusId, which is the
// current ERP behaviour. No new tables, columns, endpoints or business rules.

export type Lang = "en" | "ar";

export type DiscountType = "amount" | "percent";

export interface BuildingTypeDef {
  value: string;
  en: string;
  ar: string;
  code: string;
}

// Common building/property types. `code` seeds the auto-generated building code
// prefix (fully editable in the wizard).
export const BUILDING_TYPES: BuildingTypeDef[] = [
  { value: "residential", en: "Residential Building", ar: "مبنى سكني", code: "R" },
  { value: "villa", en: "Villa", ar: "فيلا", code: "V" },
  { value: "townhouse", en: "Townhouse", ar: "تاون هاوس", code: "TH" },
  { value: "twin_house", en: "Twin House", ar: "توين هاوس", code: "TW" },
  { value: "commercial", en: "Commercial Building", ar: "مبنى تجاري", code: "C" },
  { value: "administrative", en: "Administrative Building", ar: "مبنى إداري", code: "AD" },
  { value: "medical", en: "Medical Building", ar: "مبنى طبي", code: "MD" },
  { value: "mixed_use", en: "Mixed Use", ar: "متعدد الاستخدام", code: "MX" },
  { value: "mall", en: "Mall", ar: "مول تجاري", code: "ML" },
  { value: "other", en: "Other", ar: "أخرى", code: "B" },
];

export function buildingTypeLabel(value: string, lang: Lang): string {
  const t = BUILDING_TYPES.find((b) => b.value === value);
  if (!t) return value;
  return lang === "ar" ? t.ar : t.en;
}

export function buildingTypeCode(value: string): string {
  return BUILDING_TYPES.find((b) => b.value === value)?.code ?? "B";
}

// ---------------------------------------------------------------------------
// Draft model (client-side only, persisted to localStorage for resume)
// ---------------------------------------------------------------------------

export interface DraftUnit {
  id: string;
  /** Server id once created (enables resume after a partial commit). */
  serverId?: string;
  /** Per-floor unit number, e.g. "101" or "G01". */
  number: string;
  /** Full structured code for display/printing: BuildingCode-FloorUnit. */
  fullCode: string;
  area: string;
  bedrooms: string;
  bathrooms: string;
  // Pricing (Step 6) — computed net is written to the existing units.basePrice.
  pricePerMeter: string;
  discount: string;
  discountType: DiscountType;
  additionalCharges: string;
  // Availability (Step 7) — existing unit_statuses row id. Empty = default.
  unitStatusId: string;
}

export interface DraftFloor {
  id: string;
  serverId?: string;
  /** Floor code segment used in unit numbers, e.g. "G", "1", "PH". */
  segment: string;
  name: string;
  nameAr: string;
  floorNumber: number;
  units: DraftUnit[];
}

export interface DraftBuilding {
  id: string;
  serverId?: string;
  type: string;
  code: string;
  name: string;
  nameAr: string;
  floors: DraftFloor[];
}

export interface DraftPhase {
  id: string;
  serverId?: string;
  code: string;
  name: string;
  nameAr: string;
  buildings: DraftBuilding[];
}

export interface DraftState {
  projectMode: "create" | "existing";
  existingProjectId: string;
  /** Server id of a project created during a partial commit (resume support). */
  committedProjectId?: string;
  projectCode: string;
  projectName: string;
  projectNameAr: string;
  projectLocation: string;
  phases: DraftPhase[];
}

export function emptyDraft(): DraftState {
  return {
    projectMode: "create",
    existingProjectId: "",
    projectCode: "",
    projectName: "",
    projectNameAr: "",
    projectLocation: "",
    phases: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export interface FloorSpec {
  basements: number;
  ground: boolean;
  groundGarden: boolean;
  mezzanine: boolean;
  typicalFloors: number;
  penthouse: boolean;
  roof: boolean;
}

export function defaultFloorSpec(): FloorSpec {
  return {
    basements: 0,
    ground: true,
    groundGarden: false,
    mezzanine: false,
    typicalFloors: 1,
    penthouse: false,
    roof: false,
  };
}

interface FloorDescriptor {
  segment: string;
  name: string;
  nameAr: string;
  floorNumber: number;
}

// Generate an ordered floor list (lowest to highest) from a spec.
export function buildFloorDescriptors(spec: FloorSpec): FloorDescriptor[] {
  const out: FloorDescriptor[] = [];
  let order = -spec.basements;

  for (let i = spec.basements; i >= 1; i--) {
    out.push({
      segment: `B${i}`,
      name: spec.basements > 1 ? `Basement ${i}` : "Basement",
      nameAr: spec.basements > 1 ? `بدروم ${i}` : "بدروم",
      floorNumber: order++,
    });
  }
  if (spec.ground) {
    out.push({ segment: "G", name: "Ground Floor", nameAr: "الدور الأرضي", floorNumber: order++ });
  }
  if (spec.groundGarden) {
    out.push({ segment: "GG", name: "Ground + Garden", nameAr: "أرضي بحديقة", floorNumber: order++ });
  }
  if (spec.mezzanine) {
    out.push({ segment: "M", name: "Mezzanine", nameAr: "ميزانين", floorNumber: order++ });
  }
  for (let i = 1; i <= spec.typicalFloors; i++) {
    out.push({ segment: String(i), name: `Floor ${i}`, nameAr: `الدور ${i}`, floorNumber: order++ });
  }
  if (spec.penthouse) {
    out.push({ segment: "PH", name: "Penthouse", nameAr: "بنتهاوس", floorNumber: order++ });
  }
  if (spec.roof) {
    out.push({ segment: "R", name: "Roof", nameAr: "السطح", floorNumber: order++ });
  }
  return out;
}

export function unitNumber(floorSegment: string, sequence: number): string {
  return `${floorSegment}${pad2(sequence)}`;
}

export function unitFullCode(buildingCode: string, number: string): string {
  return `${buildingCode}-${number}`;
}

export function makeUnit(buildingCode: string, floorSegment: string, sequence: number): DraftUnit {
  const number = unitNumber(floorSegment, sequence);
  return {
    id: uid(),
    number,
    fullCode: unitFullCode(buildingCode, number),
    area: "",
    bedrooms: "",
    bathrooms: "",
    pricePerMeter: "",
    discount: "",
    discountType: "amount",
    additionalCharges: "",
    unitStatusId: "",
  };
}

function toNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface PricingResult {
  total: number;
  discountAmount: number;
  net: number;
}

export function computePricing(u: {
  area: string;
  pricePerMeter: string;
  discount: string;
  discountType: DiscountType;
  additionalCharges: string;
}): PricingResult {
  const total = toNumber(u.area) * toNumber(u.pricePerMeter);
  const rawDiscount = toNumber(u.discount);
  const discountAmount = u.discountType === "percent" ? (total * rawDiscount) / 100 : rawDiscount;
  const net = Math.max(0, total - discountAmount + toNumber(u.additionalCharges));
  return { total, discountAmount, net };
}

export function money(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
}

// Recompute every unit's fullCode after a building code or floor segment change.
export function reindexBuilding(building: DraftBuilding): DraftBuilding {
  return {
    ...building,
    floors: building.floors.map((f) => ({
      ...f,
      units: f.units.map((u) => ({ ...u, fullCode: unitFullCode(building.code, u.number) })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Draft roll-up counts (for the review step and progress hints)
// ---------------------------------------------------------------------------

export interface DraftCounts {
  phases: number;
  buildings: number;
  floors: number;
  units: number;
}

export function countDraft(draft: DraftState): DraftCounts {
  let buildings = 0;
  let floors = 0;
  let units = 0;
  for (const p of draft.phases) {
    buildings += p.buildings.length;
    for (const b of p.buildings) {
      floors += b.floors.length;
      for (const f of b.floors) units += f.units.length;
    }
  }
  return { phases: draft.phases.length, buildings, floors, units };
}
