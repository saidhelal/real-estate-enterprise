import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  companiesTable,
  contractorContractsTable,
  paymentCertificatesTable,
  certificateItemsTable,
  contractorDeductionsTable,
  contractorAdditionsTable,
  retentionsTable,
  advanceRecoveriesTable,
} from "@workspace/db";
import {
  certificateTotals,
  applyCertificateTotals,
  applyItemTotals,
  certificateAdjustments,
} from "../src/lib/certificate-amounts";

/**
 * The cumulative arithmetic of interim payment certificates.
 *
 * A contractor is paid against the cumulative value of the contract, so a
 * certificate carries what was certified before it, what this period adds, and
 * the running total. All three were text boxes: nothing added them up, and the
 * one figure a contractor and an owner argue over was the one the system did
 * not compute.
 *
 * FIXTURE data under a per-run tag, removed in `afterAll`.
 */

const tag = `ipctest-${Date.now()}`;
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const COMPANY = id(1);
const CONTRACT = id(2);
const OTHER_CONTRACT = id(3);

const ipc1 = id(10);
const ipc2 = id(11);
const ipc3 = id(12);
const cancelled = id(13);
const standalone = id(14);
const otherContractCert = id(15);

beforeAll(async () => {
  await db.insert(companiesTable).values({
    id: COMPANY,
    code: `${tag}-C`,
    name: `${tag} Company`,
    nameAr: "شركة اختبار",
  });
  await db.insert(contractorContractsTable).values([
    { id: CONTRACT, companyId: COMPANY, code: `${tag}-CT1`, title: "Tower A", titleAr: "برج أ" },
    { id: OTHER_CONTRACT, companyId: COMPANY, code: `${tag}-CT2`, title: "Tower B", titleAr: "برج ب" },
  ]);

  await db.insert(paymentCertificatesTable).values([
    { id: ipc1, companyId: COMPANY, code: `${tag}-IPC1`, contractId: CONTRACT, certificateDate: "2026-01-31", currentAmount: "100000.00", status: "posted" },
    { id: ipc2, companyId: COMPANY, code: `${tag}-IPC2`, contractId: CONTRACT, certificateDate: "2026-02-28", currentAmount: "150000.00", status: "posted" },
    { id: ipc3, companyId: COMPANY, code: `${tag}-IPC3`, contractId: CONTRACT, certificateDate: "2026-03-31", currentAmount: "80000.00", status: "approved" },
    // Certified nothing: the owner refused it.
    { id: cancelled, companyId: COMPANY, code: `${tag}-IPCX`, contractId: CONTRACT, certificateDate: "2026-02-15", currentAmount: "999999.00", status: "cancelled" },
    // No contract at all.
    { id: standalone, companyId: COMPANY, code: `${tag}-IPCS`, certificateDate: "2026-03-31", currentAmount: "5000.00", status: "approved" },
    // A different contract entirely.
    { id: otherContractCert, companyId: COMPANY, code: `${tag}-IPCB`, contractId: OTHER_CONTRACT, certificateDate: "2026-01-31", currentAmount: "777000.00", status: "posted" },
  ]);
});

afterAll(async () => {
  await db.delete(contractorDeductionsTable).where(eq(contractorDeductionsTable.companyId, COMPANY));
  await db.delete(contractorAdditionsTable).where(eq(contractorAdditionsTable.companyId, COMPANY));
  await db.delete(retentionsTable).where(eq(retentionsTable.companyId, COMPANY));
  await db.delete(advanceRecoveriesTable).where(eq(advanceRecoveriesTable.companyId, COMPANY));
  await db.delete(certificateItemsTable).where(eq(certificateItemsTable.companyId, COMPANY));
  await db.delete(paymentCertificatesTable).where(eq(paymentCertificatesTable.companyId, COMPANY));
  await db.delete(contractorContractsTable).where(eq(contractorContractsTable.companyId, COMPANY));
  await db.delete(companiesTable).where(eq(companiesTable.id, COMPANY));
});

describe("what was certified before this certificate", () => {
  const exec = db as unknown as Parameters<typeof certificateTotals>[0];

  it("is nothing for the first certificate of a contract", async () => {
    const t = await certificateTotals(exec, {
      id: ipc1,
      contractId: CONTRACT,
      currentAmount: "100000.00",
      certificateDate: "2026-01-31",
    });
    expect(t.previousAmount).toBe("0.00");
    expect(t.grossAmount).toBe("100000.00");
  });

  it("accumulates the certificates issued before it", async () => {
    const t = await certificateTotals(exec, {
      id: ipc3,
      contractId: CONTRACT,
      currentAmount: "80000.00",
      certificateDate: "2026-03-31",
    });
    expect(t.previousAmount).toBe("250000.00"); // 100k + 150k
    expect(t.grossAmount).toBe("330000.00");
  });

  it("leaves out a certificate that certified nothing", async () => {
    // The cancelled one sits inside the date range and is nine times the size
    // of everything else; counting it would have the contractor's cumulative
    // claim include work the owner refused.
    const t = await certificateTotals(exec, {
      id: ipc3,
      contractId: CONTRACT,
      currentAmount: "0",
      certificateDate: "2026-03-31",
    });
    expect(t.previousAmount).toBe("250000.00");
  });

  it("never reaches into another contract", async () => {
    const t = await certificateTotals(exec, {
      id: otherContractCert,
      contractId: OTHER_CONTRACT,
      currentAmount: "777000.00",
      certificateDate: "2026-01-31",
    });
    expect(t.previousAmount).toBe("0.00");
  });

  it("treats a certificate with no contract as standing alone", async () => {
    const t = await certificateTotals(exec, {
      id: standalone,
      contractId: null,
      currentAmount: "5000.00",
      certificateDate: "2026-03-31",
    });
    expect(t.previousAmount).toBe("0.00");
    expect(t.grossAmount).toBe("5000.00");
  });

  it("does not count a certificate of the same date as previous to it", async () => {
    // With no ordering between two same-day certificates, treating either as
    // prior would make the pair's totals depend on which was saved first.
    const sameDay = await certificateTotals(exec, {
      id: ipc2,
      contractId: CONTRACT,
      currentAmount: "150000.00",
      certificateDate: "2026-01-31",
    });
    expect(sameDay.previousAmount).toBe("0.00");
  });
});

describe("storing the derived figures", () => {
  it("writes them onto the certificate", async () => {
    await db.transaction((tx) => applyCertificateTotals(tx, ipc3));
    const [row] = await db
      .select()
      .from(paymentCertificatesTable)
      .where(eq(paymentCertificatesTable.id, ipc3));
    expect(row.previousAmount).toBe("250000.00");
    expect(row.grossAmount).toBe("330000.00");
  });

  it("re-derives rather than adding to what was there", async () => {
    // Running it twice must not double anything — the figure is computed from
    // the series, not accumulated onto the stored value.
    await db.transaction((tx) => applyCertificateTotals(tx, ipc3));
    const [row] = await db
      .select()
      .from(paymentCertificatesTable)
      .where(eq(paymentCertificatesTable.id, ipc3));
    expect(row.grossAmount).toBe("330000.00");
  });
});

describe("the deductions the certificate actually carries", () => {
  // The four totals feeding net_amount were text boxes, so what a contractor
  // was paid could disagree with the very deductions filed against the
  // certificate. They are now the sum of those records.
  const CERT = ipc1;

  beforeAll(async () => {
    await db.insert(contractorDeductionsTable).values([
      { companyId: COMPANY, code: `${tag}-D1`, certificateId: CERT, amount: "5000.00", status: "approved" },
      { companyId: COMPANY, code: `${tag}-D2`, certificateId: CERT, amount: "1500.00", status: "draft" },
      // Decided nothing, so it must not reduce the payment.
      { companyId: COMPANY, code: `${tag}-D3`, certificateId: CERT, amount: "90000.00", status: "cancelled" },
    ]);
    await db.insert(contractorAdditionsTable).values({
      companyId: COMPANY,
      code: `${tag}-A1`,
      certificateId: CERT,
      amount: "2000.00",
      status: "approved",
    });
    await db.insert(retentionsTable).values({
      companyId: COMPANY,
      code: `${tag}-R1`,
      certificateId: CERT,
      retainedAmount: "10000.00",
      releasedAmount: "4000.00",
    });
    await db.insert(advanceRecoveriesTable).values({
      companyId: COMPANY,
      code: `${tag}-AR1`,
      certificateId: CERT,
      amount: "3000.00",
    });
  });

  it("adds up only the lines that decided something", async () => {
    const a = await certificateAdjustments(db, CERT);
    expect(a.deductionsAmount).toBe("6500.00"); // 5000 + 1500, not the cancelled 90000
    expect(a.additionsAmount).toBe("2000.00");
  });

  it("counts only the retention still held", async () => {
    // Released money has gone back to the contractor and is no longer a
    // deduction from this certificate.
    const a = await certificateAdjustments(db, CERT);
    expect(a.retentionAmount).toBe("6000.00"); // 10000 retained - 4000 released
  });

  it("recomputes the net from the documents, not from what was typed", async () => {
    await db
      .update(paymentCertificatesTable)
      .set({ netAmount: "999999.00", deductionsAmount: "0" })
      .where(eq(paymentCertificatesTable.id, CERT));

    await db.transaction((tx) => applyCertificateTotals(tx, CERT));
    const [row] = await db
      .select()
      .from(paymentCertificatesTable)
      .where(eq(paymentCertificatesTable.id, CERT));

    // current 100000 + additions 2000 - retention 6000 - advance 3000 - deductions 6500
    expect(row.deductionsAmount).toBe("6500.00");
    expect(row.netAmount).toBe("86500.00");
  });
});

describe("a certificate line", () => {
  it("adds this period's quantity to the previous one", async () => {
    const line = id(20);
    await db.insert(certificateItemsTable).values({
      id: line,
      companyId: COMPANY,
      certificateId: ipc3,
      previousQuantity: "120",
      currentQuantity: "35",
      rate: "250",
      // Deliberately wrong: the point is that these are recomputed.
      cumulativeQuantity: "1",
      amount: "1",
    });

    await db.transaction((tx) => applyItemTotals(tx, line));
    const [row] = await db
      .select()
      .from(certificateItemsTable)
      .where(eq(certificateItemsTable.id, line));

    expect(Number(row.cumulativeQuantity)).toBe(155);
    // The money is this period's work at the agreed rate — charging the
    // cumulative quantity would pay for the same work on every certificate.
    expect(Number(row.amount)).toBe(8750); // 35 x 250
  });
});
