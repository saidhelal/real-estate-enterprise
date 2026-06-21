import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, asc, desc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import {
  CreateAiConversationBody,
  SendAiMessageBody,
  GenerateAiInsightsBody,
  GenerateAiInsightsResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import {
  aiCompleteJson,
  aiStreamText,
  aiConfigured,
  resolveAiModel,
  type ChatMsg,
} from "../lib/ai-provider";
import { buildErpContext, type ContextFilters } from "../lib/ai-context";

const router: IRouter = Router();

// Path-scoped guards: requireAuth THEN requirePermission, both bound to /ai so
// they never leak onto sibling routers mounted on the same app.
router.use("/ai", requireAuth);
router.use("/ai", requirePermission("ai.view"));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const AiAnalysisInput = GenerateAiInsightsBody;
const AiAnalysisResult = GenerateAiInsightsResponse;

function langName(language: string | undefined): string {
  return language === "ar" ? "Arabic" : "English";
}

/**
 * Resolve the company the AI is allowed to ground on. Company scope is enforced
 * from the authenticated user, never trusted from the request body: a user bound
 * to a company can only ever see that company's data (the requested companyId is
 * ignored). Only an unassigned user (companyId null — e.g. the super admin) may
 * filter to a specific requested company; with no request they see all companies.
 */
function effectiveCompanyId(
  user: { companyId: string | null },
  requested: string | null | undefined,
): string | null {
  if (user.companyId) return user.companyId;
  return requested ?? null;
}

function filtersFrom(
  user: { companyId: string | null },
  body: {
    companyId?: string;
    from?: string;
    to?: string;
    projectId?: string;
    branchId?: string;
  },
): ContextFilters {
  return {
    companyId: effectiveCompanyId(user, body.companyId),
    from: body.from ?? null,
    to: body.to ?? null,
    projectId: body.projectId ?? null,
    branchId: body.branchId ?? null,
  };
}

const BASE_SYSTEM =
  "You are the Enterprise AI Assistant embedded in a real-estate holding " +
  "company's ERP. You are a single, system-wide assistant available from every " +
  "screen — not tied to any one module. Your remit spans the whole enterprise: " +
  "sales & CRM, reservations, contracts, installments & collections, finance, " +
  "treasury, accounting, procurement, inventory, engineering & construction, " +
  "contractors, HR, legal affairs, fixed assets, land bank, customer service, " +
  "marketing, document management, general administration, and business " +
  "intelligence.\n\n" +
  "WHAT YOU CAN DO:\n" +
  "- Search and answer questions across departments using ONLY the authorized " +
  "ERP data provided in the DATA block.\n" +
  "- Analyze cross-department workflows and relationships (e.g. a contract's " +
  "collections, a project's construction and procurement).\n" +
  "- Produce concise report-style summaries and an enterprise status overview.\n" +
  "- Detect inconsistencies, risks, and anomalies in the figures.\n" +
  "- Suggest concrete next actions.\n" +
  "- Guide the user to the right screen using in-app navigation links.\n\n" +
  "GROUNDING RULES:\n" +
  "- Answer ONLY from the structured ERP data in the DATA block. Never invent " +
  "figures, customers, contracts, or events.\n" +
  "- The DATA block already reflects this user's permissions and company scope. " +
  "If a domain the user asks about is absent from the data, they likely lack " +
  "permission or there is no data — say so plainly; do not guess.\n" +
  "- All monetary figures are in the company's base currency.\n" +
  "- Be concise, executive, and specific; cite the actual numbers from the data.\n\n" +
  "EXECUTIVE ADVISORY MODE:\n" +
  "- You are an Executive ERP Advisor, not only a data-retrieval assistant. When " +
  "the user asks for a company summary, project/portfolio status, customer " +
  "status, financial position, operational status, or any broad 'how are we " +
  "doing / give me an overview' question, do NOT merely list statistics. After " +
  "stating the key figures, deliver a structured executive briefing using these " +
  "Markdown headings (skip a heading only when the data genuinely offers nothing " +
  "for it — never pad with speculation):\n" +
  "  - **Executive Summary** — 2-4 sentences on overall health and the headline " +
  "numbers.\n" +
  "  - **Business Risks** — financial, legal, commercial, or compliance " +
  "exposures evident in the figures (e.g. concentration of overdue AR, returned " +
  "cheques, pending legal claims, negative cash trend).\n" +
  "  - **Operational Bottlenecks** — backlogs, overdue items, stalled or pending " +
  "workflows, low inventory, unposted entries, pending approvals.\n" +
  "  - **Cross-Department Observations** — connections across modules (e.g. " +
  "collections lagging behind sales, procurement vs construction progress, " +
  "handover backlog vs completed contracts).\n" +
  "  - **Recommended Priorities** — a short ranked list of what matters most now.\n" +
  "  - **Suggested Next Actions** — concrete steps; pair them with erp-action " +
  "blocks (see ACTIONS) when a specific screen or process applies.\n" +
  "  - **Critical Alerts** — items needing immediate management attention " +
  "(severely overdue receivables, returned cheques, expiring/expired contracts, " +
  "active legal exposure, locked user accounts, breached limits). Include this " +
  "heading ONLY when something truly warrants escalation.\n" +
  "- Every observation, risk, and recommendation MUST be derived from the actual " +
  "numbers in the DATA block — quantify with counts, amounts, ratios, or trends " +
  "wherever possible, and never infer facts that are not present. Analysis and " +
  "judgement are encouraged; fabricated data is not.\n" +
  "- For narrow factual questions (a single record, one specific figure, a " +
  "yes/no), answer directly and concisely WITHOUT the full briefing.\n" +
  "- PRECEDENCE: if the TASK or caller requires a STRICT JSON / fixed-schema " +
  "response, that format wins — do NOT emit Markdown headings or erp-action " +
  "blocks; instead map the executive analysis (summary, risks, bottlenecks, " +
  "priorities, alerts) into the required JSON fields only.\n\n" +
  "NAVIGATION (inline links):\n" +
  "- When you mention a screen in prose, write it as a Markdown link with an " +
  "in-app path from the SCREENS list, e.g. [Receipts](/receipts). Only use paths " +
  "from the SCREENS list; never invent routes or use external URLs.\n\n" +
  "ACTIONS (you are an ERP business assistant, not only a chatbot):\n" +
  "- Besides answering, you can PROPOSE concrete ERP actions the user can run " +
  "with one click. Propose an action by appending a fenced code block with the " +
  "language tag erp-action containing a single JSON object. You may include " +
  "several such blocks (one per action). Put a short natural-language summary in " +
  "your normal text first, then the action block(s) at the end.\n" +
  "- Action JSON shape: {\"kind\": <one of open|report|search|create|workflow>, " +
  "\"label\": <short button text>, \"path\": <in-app path from SCREENS>, " +
  '"note": <optional one-line description>}.\n' +
  "- kind meanings: open = open a screen or record (read-only); report = open a " +
  "report/analytics screen; search = open a list screen so the user can search/" +
  "filter; create = begin creating a new draft record; workflow = start a " +
  "multi-step business process.\n" +
  "- 'path' MUST be an in-app path beginning with '/' and chosen from SCREENS. " +
  "Never invent paths or link externally.\n" +
  "- create and workflow are DATA-CHANGING intents: the app will require the user " +
  "to explicitly confirm, then open the relevant permission-gated form to finish " +
  "and save. NEVER claim a record was created, saved, sent, or that a workflow " +
  "ran — you only PREPARE and PROPOSE; the user confirms and completes it.\n" +
  "- Only propose actions consistent with the data domains/permissions the user " +
  "has (listed below). If the user lacks access to a screen, do not propose it; " +
  "say they don't have permission instead.\n" +
  "- When the user asks to go somewhere, find/search records, open a report, " +
  "create something, or start a process, ALWAYS include the matching action " +
  "block(s) in addition to your explanation. For multi-step help, propose the " +
  "next single action, not the whole chain at once.";

/**
 * Curated catalog of the main ERP screens per module, given to the model so it
 * can navigate the user accurately. The chat UI renders any [label](/path) link
 * as an in-app navigation control. This is reference-only (it is not data) and
 * is intentionally a compact subset, not the full ~300-route table.
 */
const SCREEN_CATALOG: string = [
  "General: /dashboard, /notifications",
  "Sales & CRM: /sales-administration, /crm-dashboard, /leads, /available-units, /crm-sales, /lead-follow-ups, /crm-reports",
  "Real Estate: /projects, /buildings, /units, /unit-pricing",
  "Reservations & Contracts: /crm-sales, /legal-contracts",
  "Finance & Accounting: /accounting-dashboard, /accounts, /journal-entries, /general-ledger, /trial-balance, /balance-sheet, /income-statement, /cash-flow, /finance-inbox, /customer-invoices, /ar-aging, /supplier-invoices, /ap-aging, /receipts, /payment-vouchers",
  "Installments & Collections: /installment-plans, /installment-schedules, /installment-collections, /penalties",
  "Treasury & Banks: /cashboxes, /treasury-transactions, /bank-accounts, /bank-transactions, /cheques",
  "Fixed Assets: /fixed-assets-dashboard, /fixed-assets, /asset-depreciations, /asset-disposals, /fixed-assets-reports",
  "Engineering & Construction: /engineering-dashboard, /drawings, /boqs, /rfis, /construction-dashboard, /contractors, /contractor-contracts, /payment-certificates",
  "Procurement & Inventory: /procurement-dashboard, /suppliers, /purchase-requests, /purchase-orders, /goods-receipt-notes, /inventory-dashboard, /inventory-items, /inventory-reports",
  "HR: /hr-dashboard, /employees, /attendance, /leave-requests, /payroll-runs, /payslips, /hr-reports",
  "Legal Affairs: /legal-dashboard, /legal-contracts, /legal-cases, /legal-hearings, /legal-claims, /legal-reports",
  "Land Bank: /land-bank-dashboard, /land-parcels, /land-ownerships, /land-acquisitions, /land-bank-reports",
  "Customer Service: /customer-service-dashboard, /support-tickets, /complaints, /maintenance-requests, /work-orders, /handover-dashboard, /handover-requests",
  "Marketing: /marketing-dashboard, /marketing-campaigns, /marketing-leads, /lead-sources",
  "General Administration: /general-admin-dashboard, /correspondence, /meetings, /administrative-tasks",
  "Documents: /documents-dashboard, /documents, /document-search, /document-approvals",
  "Business Intelligence: /executive-dashboard, /executive-oversight, /reports-engine, /ai-analytics, /ai-insights, /ai-recommendations, /ai-alerts",
  "Administration: /users, /roles, /companies, /branches, /audit-logs, /settings",
].join("\n");

/**
 * Run a generative analysis feature: build the permission-scoped data context,
 * ask the model for a structured JSON result, validate it, and respond. Shared
 * by all eight non-chat AI endpoints.
 */
async function runAnalysis(
  req: Request,
  res: Response,
  feature: string,
  instruction: string,
): Promise<void> {
  if (!(await aiConfigured())) {
    res.status(503).json({ error: "AI provider is not configured." });
    return;
  }
  const parsed = AiAnalysisInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const body = parsed.data;
  const context = await buildErpContext(req.authUser!, filtersFrom(req.authUser!, body));
  const language = langName(body.language);

  const system: ChatMsg = {
    role: "system",
    content:
      `${BASE_SYSTEM}\n\nTASK: ${instruction}\n\n` +
      `Respond in ${language}. Return STRICT JSON with this exact shape: ` +
      `{"title": string, "summary": string, "sections": [{"heading": string, ` +
      `"body": string, "severity": "info"|"positive"|"warning"|"critical"}]}. ` +
      `Provide 3-6 sections. Use "severity" to flag risks (critical/warning), ` +
      `healthy signals (positive), or neutral notes (info). ` +
      `The user can view these data domains: ${context.domains.join(", ") || "none"}.\n\n` +
      `SCREENS (for navigation links):\n${SCREEN_CATALOG}` +
      (context.hasData
        ? ""
        : " NOTE: the data is empty or all-zero for this scope; say clearly that there is not enough data and do not fabricate."),
  };
  const user: ChatMsg = {
    role: "user",
    content:
      (body.prompt ? `User request: ${body.prompt}\n\n` : "") +
      `DATA (JSON):\n${JSON.stringify(context.data)}`,
  };

  let raw: string;
  try {
    raw = await aiCompleteJson([system, user]);
  } catch (err) {
    req.log.error({ err }, "AI completion failed");
    res.status(502).json({ error: "AI provider request failed." });
    return;
  }

  let modelJson: unknown;
  try {
    modelJson = JSON.parse(raw);
  } catch {
    req.log.error({ raw }, "AI returned non-JSON");
    res.status(502).json({ error: "AI returned an invalid response." });
    return;
  }

  const obj = (modelJson ?? {}) as Record<string, unknown>;
  const result = {
    feature,
    title: typeof obj.title === "string" ? obj.title : feature,
    summary: typeof obj.summary === "string" ? obj.summary : "",
    generatedAt: new Date().toISOString(),
    model: await resolveAiModel(),
    dataAvailable: context.hasData,
    sections: Array.isArray(obj.sections) ? obj.sections : [],
  };

  const validated = AiAnalysisResult.safeParse(result);
  if (!validated.success) {
    req.log.error({ issues: validated.error.issues }, "AI result failed validation");
    res.status(502).json({ error: "AI produced a malformed result." });
    return;
  }
  res.json(validated.data);
}

// ---------------------------------------------------------------------------
// Conversations (per-user)
// ---------------------------------------------------------------------------

router.get("/ai/conversations", async (req, res): Promise<void> => {
  const userId = req.authUser!.id;
  const feature = typeof req.query.feature === "string" ? req.query.feature : null;
  const where = feature
    ? and(eq(conversations.userId, userId), eq(conversations.feature, feature))
    : eq(conversations.userId, userId);
  const rows = await db
    .select()
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      feature: r.feature,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/ai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateAiConversationBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [row] = await db
    .insert(conversations)
    .values({
      userId: req.authUser!.id,
      title: parsed.data.title,
      feature: parsed.data.feature ?? "assistant",
    })
    .returning();
  await recordAudit(req, { action: "create", entity: "ai", entityId: String(row.id) });
  res.status(201).json({
    id: row.id,
    title: row.title,
    feature: row.feature,
    createdAt: row.createdAt.toISOString(),
  });
});

/** Load a conversation only if it belongs to the requesting user. */
async function ownedConversation(req: Request, id: number) {
  if (!Number.isInteger(id)) return null;
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.authUser!.id)))
    .limit(1);
  return row ?? null;
}

router.get("/ai/conversations/:id/messages", async (req, res): Promise<void> => {
  const convo = await ownedConversation(req, Number(req.params.id));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convo.id))
    .orderBy(asc(messages.id));
  res.json(
    rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      role: r.role,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

// ---------------------------------------------------------------------------
// Chat (SSE). Grounds every reply in the user's permission-scoped ERP data.
// ---------------------------------------------------------------------------

router.post("/ai/conversations/:id/messages", async (req, res): Promise<void> => {
  const convo = await ownedConversation(req, Number(req.params.id));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (!(await aiConfigured())) {
    res.status(503).json({ error: "AI provider is not configured." });
    return;
  }
  const parsed = SendAiMessageBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const content = parsed.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Message is empty" });
    return;
  }

  // Persist the user's message before answering.
  await db.insert(messages).values({
    conversationId: convo.id,
    role: "user",
    content,
  });

  // Build grounding context (scoped to the user's own company when assigned;
  // unassigned users such as the super admin see all companies) and history.
  const context = await buildErpContext(req.authUser!, {
    companyId: effectiveCompanyId(req.authUser!, null),
    from: null,
    to: null,
    projectId: null,
    branchId: null,
  });
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convo.id))
    .orderBy(asc(messages.id));

  const chat: ChatMsg[] = [
    {
      role: "system",
      content:
        `${BASE_SYSTEM} Reply in the same language the user writes in. ` +
        `The user can view these data domains: ${context.domains.join(", ") || "none"}.\n\n` +
        `SCREENS (for navigation links):\n${SCREEN_CATALOG}\n\n` +
        `DATA (JSON):\n${JSON.stringify(context.data)}`,
    },
    ...history.map((m): ChatMsg => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let full = "";
  try {
    for await (const delta of aiStreamText(chat)) {
      full += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  } catch (err) {
    req.log.error({ err }, "AI stream failed");
    res.write(`data: ${JSON.stringify({ error: "AI provider request failed." })}\n\n`);
    res.end();
    return;
  }

  // Persist the assistant reply so the thread reloads intact.
  if (full.trim()) {
    await db.insert(messages).values({
      conversationId: convo.id,
      role: "assistant",
      content: full,
    });
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ---------------------------------------------------------------------------
// Generative analysis features (eight)
// ---------------------------------------------------------------------------

router.post("/ai/insights", (req, res) =>
  runAnalysis(req, res, "insights",
    "Surface the most important insights hidden in the data — trends, " +
    "concentrations, anomalies, and what changed."));

router.post("/ai/analytics", (req, res) =>
  runAnalysis(req, res, "analytics",
    "Produce a narrative analytics summary across the available domains, " +
    "explaining the key figures and what they mean for the business."));

router.post("/ai/recommendations", (req, res) =>
  runAnalysis(req, res, "recommendations",
    "Give prioritized, actionable recommendations grounded in the data, each " +
    "tied to the specific figures that justify it."));

router.post("/ai/forecasting", (req, res) =>
  runAnalysis(req, res, "forecasting",
    "Project likely near-term outcomes (sales, collections, cash) from the " +
    "trends in the data, stating assumptions and confidence."));

router.post("/ai/alerts", (req, res) =>
  runAnalysis(req, res, "alerts",
    "Generate operational alerts: overdue collections, low cash, stalled " +
    "contracts, or anything needing attention. Use severity to rank them."));

router.post("/ai/risk-analysis", (req, res) =>
  runAnalysis(req, res, "risk-analysis",
    "Assess financial, sales, collection, and operational risk from the data. " +
    "Quantify exposure where possible and rank by severity."));

router.post("/ai/decision-support", (req, res) =>
  runAnalysis(req, res, "decision-support",
    "Frame the key decisions the data implies, with options, trade-offs, and a " +
    "recommended course of action."));

router.post("/ai/executive-advisor", (req, res) =>
  runAnalysis(req, res, "executive-advisor",
    "Write an executive advisory brief for leadership: overall health, the " +
    "few things that matter most, and what to do next."));

export default router;
