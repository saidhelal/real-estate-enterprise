import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, legalContractsTable, companiesTable } from "@workspace/db";

/* ------------------------------------------------------------------ */
/* Public contract verification — UNAUTHENTICATED.                    */
/*                                                                    */
/* Mounted before the auth-gated /api router. Looks a contract up by  */
/* its public verification handle (encoded in the document QR) and    */
/* returns ONLY non-confidential fields: code, title, status,         */
/* approval date, version, and the issuing company name. Financial    */
/* value, counterparty details and the document body are never        */
/* exposed here.                                                      */
/* ------------------------------------------------------------------ */

const router: IRouter = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>
body{font-family:system-ui,'Segoe UI',Tahoma,Arial,sans-serif;background:#f4f5f7;color:#111;margin:0;padding:24px;display:flex;justify-content:center}
.card{background:#fff;border:1px solid #e3e6ea;border-radius:12px;max-width:520px;width:100%;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600}
.ok{background:#dcfce7;color:#166534}.warn{background:#fef3c7;color:#92400e}.bad{background:#fee2e2;color:#991b1b}
h1{font-size:18px;margin:0 0 4px}.sub{color:#6b7280;font-size:13px;margin-bottom:18px}
dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0;font-size:14px}
dt{color:#6b7280}dd{margin:0;font-weight:600}
.foot{margin-top:20px;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body><div class="card">${bodyHtml}<div class="foot">التحقق من العقود — Contract Verification</div></div></body></html>`;
}

router.get("/:verificationId", async (req, res): Promise<void> => {
  const verificationId = String(req.params.verificationId);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const rows = (await db
    .select({
      code: legalContractsTable.code,
      title: legalContractsTable.title,
      titleAr: legalContractsTable.titleAr,
      status: legalContractsTable.status,
      approvedAt: legalContractsTable.approvedAt,
      currentVersion: legalContractsTable.currentVersion,
      companyId: legalContractsTable.companyId,
    })
    .from(legalContractsTable)
    .where(and(eq(legalContractsTable.verificationId, verificationId), eq(legalContractsTable.isDeleted, false)))
    .limit(1)) as Record<string, unknown>[];
  const c = rows[0];
  if (!c) {
    res.status(404).send(page("Not found", `<span class="badge bad">غير موجود — Not found</span><h1 style="margin-top:14px">رمز التحقق غير صالح</h1><div class="sub">No contract matches this verification code.</div>`));
    return;
  }

  const companyRows = (await db
    .select({ name: companiesTable.name, nameAr: companiesTable.nameAr })
    .from(companiesTable)
    .where(eq(companiesTable.id, c.companyId as string))
    .limit(1)) as Record<string, unknown>[];
  const company = companyRows[0] ?? {};

  const status = String(c.status ?? "");
  const isApproved = status === "approved" || status === "active";
  const badge = isApproved
    ? `<span class="badge ok">عقد معتمد — Verified / Approved</span>`
    : `<span class="badge warn">${escapeHtml(status)}</span>`;
  const title = escapeHtml(String(c.titleAr || c.title || c.code || ""));
  const companyName = escapeHtml(String(company.nameAr || company.name || ""));
  const approvedAt = c.approvedAt instanceof Date ? c.approvedAt.toISOString().slice(0, 10) : "";

  res.status(200).send(page(title, `${badge}
<h1 style="margin-top:14px">${title}</h1>
<div class="sub">${companyName}</div>
<dl>
<dt>رقم العقد / Contract no.</dt><dd>${escapeHtml(String(c.code ?? ""))}</dd>
<dt>الحالة / Status</dt><dd>${escapeHtml(status)}</dd>
<dt>الإصدار / Version</dt><dd>${escapeHtml(String(c.currentVersion ?? 1))}</dd>
<dt>تاريخ الاعتماد / Approved</dt><dd>${escapeHtml(approvedAt || "—")}</dd>
<dt>رمز التحقق / Verification ID</dt><dd>${escapeHtml(verificationId)}</dd>
</dl>`));
});

export default router;
