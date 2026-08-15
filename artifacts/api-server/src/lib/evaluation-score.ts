import { and, eq } from "drizzle-orm";
import {
  db,
  employeeEvaluationsTable,
  employeeEvaluationLinesTable,
  supplierEvaluationsTable,
  settingsTable,
} from "@workspace/db";
import type { Tx } from "./posting";

/**
 * What an evaluation scores, once its lines are weighted.
 *
 * `employee_evaluation_lines` carries a `weight`, a `score` and a
 * `weighted_score`, and `employee_evaluations` carries a `total_score`. All
 * four were text boxes: nothing multiplied, nothing added up, so an appraisal
 * total was whatever the person filling in the form believed it to be — and an
 * appraisal is a document people are paid and promoted against.
 *
 * ---------------------------------------------------------------------------
 * No weight is invented here.
 *
 * The weights are the company's own data — set per KPI in `kpi_templates` and
 * copied onto each evaluation line. This module supplies only the arithmetic
 * that the column names already promise, and it is deliberately the *scale-free*
 * form:
 *
 *     total = Σ(score × weight) / Σ(weight)
 *
 * Dividing by the total weight rather than by a hundred means the result is
 * correct whether a company writes its weights as percentages summing to 100,
 * as raw points, or as anything else. Assuming percentages would have been a
 * business decision smuggled in as a division.
 *
 * With no weights recorded the total is zero — not an unweighted average.
 * An evaluation nobody has weighted has not been scored, and inventing equal
 * weights would produce a number that looks like an assessment and is not one.
 * ---------------------------------------------------------------------------
 */

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string" || v.trim() === "") return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Two decimals, as the numeric columns store scores. */
const fixed = (n: number): string => n.toFixed(2);

export interface EvaluationScore {
  /** Lines that carried a weight and therefore counted. */
  weightedLines: number;
  totalWeight: number;
  /** Σ(score × weight) / Σ(weight), or 0 when nothing is weighted. */
  totalScore: number;
}

/**
 * Recompute one line's weighted score.
 *
 * `weighted = score × weight`, kept per line so an appraisal can be read as
 * "this is what each objective contributed" rather than only as a final mark.
 */
export async function applyLineScore(tx: Tx, lineId: string): Promise<void> {
  const [line] = await tx
    .select()
    .from(employeeEvaluationLinesTable)
    .where(eq(employeeEvaluationLinesTable.id, lineId));
  if (!line) return;

  await tx
    .update(employeeEvaluationLinesTable)
    .set({ weightedScore: fixed(num(line.score) * num(line.weight)) })
    .where(eq(employeeEvaluationLinesTable.id, lineId));
}

/** The evaluation's total, derived from its lines. */
export async function evaluationScore(
  exec: Tx | typeof db,
  evaluationId: string,
): Promise<EvaluationScore> {
  const lines = await exec
    .select({
      weight: employeeEvaluationLinesTable.weight,
      score: employeeEvaluationLinesTable.score,
    })
    .from(employeeEvaluationLinesTable)
    .where(
      and(
        eq(employeeEvaluationLinesTable.evaluationId, evaluationId),
        eq(employeeEvaluationLinesTable.isDeleted, false),
      ),
    );

  let totalWeight = 0;
  let weightedSum = 0;
  let weightedLines = 0;

  for (const line of lines) {
    const weight = num(line.weight);
    // A line with no weight carries no opinion about the total. Counting it as
    // weight 1 would be inventing a weight.
    if (weight <= 0) continue;
    totalWeight += weight;
    weightedSum += num(line.score) * weight;
    weightedLines++;
  }

  return {
    weightedLines,
    totalWeight,
    totalScore: totalWeight > 0 ? weightedSum / totalWeight : 0,
  };
}

/**
 * Recompute an evaluation's total and store it.
 *
 * Runs inside the caller's transaction, after the lines exist. Writes only the
 * derived column; the rating stays with whoever owns the rating bands, which
 * are not defined anywhere in this system and are not invented here.
 */
export async function applyEvaluationScore(
  tx: Tx,
  evaluationId: string,
): Promise<EvaluationScore> {
  const score = await evaluationScore(tx, evaluationId);
  await tx
    .update(employeeEvaluationsTable)
    .set({ totalScore: fixed(score.totalScore) })
    .where(eq(employeeEvaluationsTable.id, evaluationId));
  return score;
}

/* ==========================================================================
 * Supplier evaluation
 * ========================================================================== */

/**
 * Where the supplier weighting comes from, when the business sets one.
 *
 * Unlike an employee appraisal — whose weights are per-KPI data the company
 * already enters — a supplier evaluation has four fixed criteria and nowhere
 * to record what each is worth. So the weighting is a setting, and until it
 * holds a value there is no way to combine the four scores that is not an
 * invention.
 */
export const SUPPLIER_WEIGHTS_KEY = "procurement.supplierEvaluationWeights";

export interface SupplierWeights {
  price: number;
  quality: number;
  delivery: number;
  /** Contractual commitment and service. */
  service: number;
  /** Safety, documents and compliance. */
  compliance: number;
}

/** The five criteria, in the order the approved weighting names them. */
export const SUPPLIER_CRITERIA = ["price", "quality", "delivery", "service", "compliance"] as const;

/**
 * The weighting must add up to a whole.
 *
 * A weighting that sums to 90 or 110 still produces a number — the scale-free
 * average sees to that — but it is not the weighting anyone approved, and the
 * resulting score would silently be on a different scale from every other
 * supplier's. So a total that is not 100 is rejected rather than normalised:
 * the setting is wrong and someone should be told, not quietly corrected.
 */
export const SUPPLIER_WEIGHT_TOTAL = 100;

/**
 * The configured supplier weights, or null when the business has not set them.
 *
 * Null is the honest answer and the important one: it is what stops an overall
 * score being produced from weights nobody chose.
 */
export async function supplierWeights(
  exec: Tx | typeof db,
): Promise<SupplierWeights | null> {
  const [row] = await exec
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, SUPPLIER_WEIGHTS_KEY))
    .limit(1);

  if (!row?.value || String(row.value).trim() === "") return null;

  try {
    const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    if (!parsed || typeof parsed !== "object") return null;
    const source = parsed as Record<string, unknown>;

    const w: SupplierWeights = {
      price: num(source.price),
      quality: num(source.quality),
      delivery: num(source.delivery),
      service: num(source.service),
      compliance: num(source.compliance),
    };

    // Every criterion must carry a weight. A missing one is not "worth
    // nothing" — it is a weighting that was not finished, and scoring against
    // it would quietly drop a criterion from every supplier's result.
    if (SUPPLIER_CRITERIA.some((k) => w[k] <= 0)) return null;

    const total = SUPPLIER_CRITERIA.reduce((sum, k) => sum + w[k], 0);
    if (total !== SUPPLIER_WEIGHT_TOTAL) return null;

    return w;
  } catch {
    // A malformed setting is not a licence to guess.
    return null;
  }
}

/**
 * A supplier's overall score, when the weighting has been decided.
 *
 * Returns null while the setting is empty — and the caller stores nothing, so
 * `overall_score` stays as it was rather than being filled with a number the
 * business never agreed to. Same scale-free weighted average the employee side
 * uses: the weights need not sum to anything in particular.
 */
export interface SupplierScores {
  priceScore: unknown;
  qualityScore: unknown;
  deliveryScore: unknown;
  serviceScore: unknown;
  complianceScore: unknown;
}

export async function supplierOverallScore(
  exec: Tx | typeof db,
  scores: SupplierScores,
): Promise<number | null> {
  const w = await supplierWeights(exec);
  if (!w) return null;

  // A supplier scored on only some of the criteria has not been evaluated.
  // Averaging what happens to be filled in would rank a supplier judged on
  // price alone against one judged on all five, which is the misleading
  // result this refuses to produce.
  const given: Record<(typeof SUPPLIER_CRITERIA)[number], unknown> = {
    price: scores.priceScore,
    quality: scores.qualityScore,
    delivery: scores.deliveryScore,
    service: scores.serviceScore,
    compliance: scores.complianceScore,
  };
  const missing = SUPPLIER_CRITERIA.some(
    (k) => given[k] === null || given[k] === undefined || String(given[k]).trim() === "",
  );
  if (missing) return null;

  const weighted = SUPPLIER_CRITERIA.reduce((sum, k) => sum + num(given[k]) * w[k], 0);
  return weighted / SUPPLIER_WEIGHT_TOTAL;
}

/**
 * Store a supplier evaluation's overall score, if it can be computed.
 *
 * Does nothing at all while the weighting is unset. That is the difference
 * between a system waiting for a decision and one that quietly made it.
 */
export async function applySupplierScore(tx: Tx, evaluationId: string): Promise<number | null> {
  const [row] = await tx
    .select()
    .from(supplierEvaluationsTable)
    .where(eq(supplierEvaluationsTable.id, evaluationId));
  if (!row) return null;

  const overall = await supplierOverallScore(tx, {
    priceScore: row.priceScore,
    qualityScore: row.qualityScore,
    deliveryScore: row.deliveryScore,
    serviceScore: row.serviceScore,
    complianceScore: row.complianceScore,
  });
  if (overall === null) return null;

  await tx
    .update(supplierEvaluationsTable)
    .set({ overallScore: fixed(overall) })
    .where(eq(supplierEvaluationsTable.id, evaluationId));
  return overall;
}
