import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  companiesTable,
  employeesTable,
  employeeEvaluationsTable,
  employeeEvaluationLinesTable,
  settingsTable,
} from "@workspace/db";
import {
  evaluationScore,
  applyEvaluationScore,
  applyLineScore,
  supplierWeights,
  supplierOverallScore,
  SUPPLIER_WEIGHTS_KEY,
  SUPPLIER_CRITERIA,
  SUPPLIER_WEIGHT_TOTAL,
} from "../src/lib/evaluation-score";

/**
 * The weighted total of an appraisal.
 *
 * `weight`, `score`, `weighted_score` and `total_score` were all text boxes:
 * nothing multiplied and nothing added up, so an appraisal total was whatever
 * was typed into it — on a document people are paid and promoted against.
 *
 * No weight is invented anywhere here. The weights are the company's own data;
 * these check only that the arithmetic the column names promise is the
 * arithmetic performed, and that an unweighted evaluation scores nothing
 * rather than being silently averaged.
 *
 * FIXTURE data under a per-run tag, removed in `afterAll`.
 */

const tag = `evaltest-${Date.now()}`;
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const COMPANY = id(1);
const EMPLOYEE = id(2);
const weighted = id(10);
const unweighted = id(11);
const pointScale = id(12);

beforeAll(async () => {
  await db.insert(companiesTable).values({
    id: COMPANY,
    code: `${tag}-C`,
    name: `${tag} Company`,
    nameAr: "شركة اختبار",
  });
  await db.insert(employeesTable).values({
    id: EMPLOYEE,
    companyId: COMPANY,
    code: `${tag}-E`,
    firstName: "Fixture",
    lastName: "Employee",
  });
  await db.insert(employeeEvaluationsTable).values([
    { id: weighted, companyId: COMPANY, code: `${tag}-EV1`, employeeId: EMPLOYEE },
    { id: unweighted, companyId: COMPANY, code: `${tag}-EV2`, employeeId: EMPLOYEE },
    { id: pointScale, companyId: COMPANY, code: `${tag}-EV3`, employeeId: EMPLOYEE },
  ]);
});

afterAll(async () => {
  await db.delete(employeeEvaluationLinesTable).where(eq(employeeEvaluationLinesTable.companyId, COMPANY));
  await db.delete(employeeEvaluationsTable).where(eq(employeeEvaluationsTable.companyId, COMPANY));
  await db.delete(employeesTable).where(eq(employeesTable.id, EMPLOYEE));
  await db.delete(companiesTable).where(eq(companiesTable.id, COMPANY));
});

describe("weights expressed as percentages", () => {
  beforeAll(async () => {
    // 60% at 90, 40% at 70  ->  (90×60 + 70×40) / 100 = 82
    await db.insert(employeeEvaluationLinesTable).values([
      { companyId: COMPANY, evaluationId: weighted, weight: "60", score: "90" },
      { companyId: COMPANY, evaluationId: weighted, weight: "40", score: "70" },
    ]);
  });

  it("returns the weighted average, not the plain one", async () => {
    // The plain average would be 80. The weighted one is 82, and the
    // difference is the whole point of the weights.
    const s = await evaluationScore(db, weighted);
    expect(s.totalWeight).toBe(100);
    expect(s.weightedLines).toBe(2);
    expect(s.totalScore).toBe(82);
  });

  it("stores it on the evaluation", async () => {
    await db.transaction((tx) => applyEvaluationScore(tx, weighted));
    const [row] = await db
      .select()
      .from(employeeEvaluationsTable)
      .where(eq(employeeEvaluationsTable.id, weighted));
    expect(Number(row.totalScore)).toBe(82);
  });
});

describe("weights expressed as raw points", () => {
  beforeAll(async () => {
    // 3 points at 80, 1 point at 40  ->  (240 + 40) / 4 = 70
    await db.insert(employeeEvaluationLinesTable).values([
      { companyId: COMPANY, evaluationId: pointScale, weight: "3", score: "80" },
      { companyId: COMPANY, evaluationId: pointScale, weight: "1", score: "40" },
    ]);
  });

  it("is correct without assuming the weights sum to a hundred", async () => {
    // Dividing by 100 would have given 2.8 here. Dividing by the total weight
    // is what makes the method scale-free — and what keeps a business decision
    // about the weighting scale out of the code.
    const s = await evaluationScore(db, pointScale);
    expect(s.totalWeight).toBe(4);
    expect(s.totalScore).toBe(70);
  });
});

describe("an evaluation nobody weighted", () => {
  beforeAll(async () => {
    await db.insert(employeeEvaluationLinesTable).values([
      { companyId: COMPANY, evaluationId: unweighted, weight: "0", score: "95" },
      { companyId: COMPANY, evaluationId: unweighted, weight: "0", score: "85" },
    ]);
  });

  it("scores nothing rather than inventing equal weights", async () => {
    // 90 would look like an assessment and would not be one: nobody has said
    // what these objectives are worth relative to each other.
    const s = await evaluationScore(db, unweighted);
    expect(s.weightedLines).toBe(0);
    expect(s.totalScore).toBe(0);
  });
});

describe("each line carries its own contribution", () => {
  it("records score times weight on the line", async () => {
    const lineId = id(20);
    await db.insert(employeeEvaluationLinesTable).values({
      id: lineId,
      companyId: COMPANY,
      evaluationId: weighted,
      weight: "25",
      score: "80",
      // Deliberately wrong: the point is that it is recomputed.
      weightedScore: "1",
    });

    await db.transaction((tx) => applyLineScore(tx, lineId));
    const [row] = await db
      .select()
      .from(employeeEvaluationLinesTable)
      .where(eq(employeeEvaluationLinesTable.id, lineId));
    expect(Number(row.weightedScore)).toBe(2000); // 80 × 25
  });

  it("re-derives the total once a line is added", async () => {
    // 60@90 + 40@70 + 25@80 -> (5400 + 2800 + 2000) / 125 = 81.6
    const s = await evaluationScore(db, weighted);
    expect(s.totalWeight).toBe(125);
    expect(s.totalScore).toBeCloseTo(81.6, 5);
  });
});

describe("supplier evaluation, at the approved weighting", () => {
  // price 30, quality 25, delivery 20, service 15, compliance 10 = 100.
  const APPROVED = JSON.stringify({ price: 30, quality: 25, delivery: 20, service: 15, compliance: 10 });

  const FULL = {
    priceScore: "80",
    qualityScore: "60",
    deliveryScore: "90",
    serviceScore: "70",
    complianceScore: "50",
  };

  const setWeights = (value: string) =>
    db
      .insert(settingsTable)
      .values({ key: SUPPLIER_WEIGHTS_KEY, value, category: "procurement", label: "Supplier Evaluation Weights" })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });

  beforeAll(async () => {
    await setWeights(APPROVED);
  });

  afterAll(async () => {
    // Leave the shipped policy in place, not whatever the last test set.
    await setWeights(APPROVED);
  });

  it("reads the five approved weights", async () => {
    const w = await supplierWeights(db);
    expect(w).toEqual({ price: 30, quality: 25, delivery: 20, service: 15, compliance: 10 });
  });

  it("the weights total one hundred", async () => {
    const w = await supplierWeights(db);
    const total = SUPPLIER_CRITERIA.reduce((sum, k) => sum + w![k], 0);
    expect(total).toBe(SUPPLIER_WEIGHT_TOTAL);
  });

  it("scores a fully evaluated supplier", async () => {
    // (80×30 + 60×25 + 90×20 + 70×15 + 50×10) / 100
    // = (2400 + 1500 + 1800 + 1050 + 500) / 100 = 72.5
    expect(await supplierOverallScore(db, FULL)).toBeCloseTo(72.5, 5);
  });

  it("is not the plain average of the five scores", async () => {
    // The unweighted mean is 70. The weighting is what makes it 72.5, and a
    // screen computing its own average would disagree with the register.
    const plain = (80 + 60 + 90 + 70 + 50) / 5;
    expect(plain).toBe(70);
    expect(await supplierOverallScore(db, FULL)).not.toBeCloseTo(plain, 5);
  });

  it("refuses a weighting that does not total one hundred", async () => {
    await setWeights(JSON.stringify({ price: 30, quality: 25, delivery: 20, service: 15, compliance: 20 }));
    expect(await supplierWeights(db)).toBeNull();
    expect(await supplierOverallScore(db, FULL)).toBeNull();
  });

  it("refuses a weighting missing a criterion", async () => {
    // A missing criterion is an unfinished policy, not a criterion worth zero.
    await setWeights(JSON.stringify({ price: 30, quality: 25, delivery: 20, service: 25 }));
    expect(await supplierWeights(db)).toBeNull();
  });

  it("refuses a malformed weighting rather than guessing", async () => {
    await setWeights("not json");
    expect(await supplierWeights(db)).toBeNull();
  });

  it("gives no score to a supplier missing an evaluation criterion", async () => {
    // Ranking a supplier judged on four criteria beside one judged on five is
    // the misleading result this refuses to produce.
    await setWeights(APPROVED);
    const partial = { ...FULL, complianceScore: null };
    expect(await supplierOverallScore(db, partial)).toBeNull();
  });

  it("names each criterion exactly once", async () => {
    expect(new Set(SUPPLIER_CRITERIA).size).toBe(SUPPLIER_CRITERIA.length);
    expect([...SUPPLIER_CRITERIA].sort()).toEqual(
      ["compliance", "delivery", "price", "quality", "service"],
    );
  });
});
