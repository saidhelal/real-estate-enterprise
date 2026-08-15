import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Architecture fitness tests.
 *
 * The audit that preceded these found a second numbering engine, a browser
 * generating business codes, and three routes letting the client choose an
 * invoice number. Every one of them was written by someone who did not know a
 * central engine already existed. Documenting the rule would not have stopped
 * any of them — a rule nothing checks is a rule that decays.
 *
 * So these fail the build instead. Each assertion names the engine that should
 * have been used, so the failure tells you what to do rather than only what
 * not to do.
 *
 * Every exception is listed explicitly, with the reason it is one. An
 * allowlist that has to be edited is a decision someone made on purpose;
 * a rule that quietly permits anything is not a rule.
 */

const SRC = join(import.meta.dirname, "..", "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/**
 * Comments and block comments removed.
 *
 * Without this the rules fire on their own documentation: `posting.ts` explains
 * that it used to fall back to `Math.random()`, and a rule that reads comments
 * would demand the explanation be deleted. Strings are left alone — a business
 * identifier can be built in one.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const FILES = walk(SRC).map((path) => ({
  path,
  rel: path.slice(SRC.length + 1).replace(/\\/g, "/"),
  text: readFileSync(path, "utf8"),
  code: stripComments(readFileSync(path, "utf8")),
}));

/** Files allowed to reach the sequence table directly, and why. */
const SEQUENCE_TABLE_ALLOWLIST = new Set([
  // The engine itself.
  "lib/doc-number.ts",
  // The admin screen's CRUD over sequence definitions: it manages the rows,
  // it does not draw numbers from them.
  "routes/number-sequences.ts",
  // Seeds the initial definitions on a fresh database.
  "seed.ts",
]);

describe("numbering is owned by one engine", () => {
  it("nothing but the engine and its admin surface touches number_sequences", () => {
    const offenders = FILES.filter(
      (f) => /numberSequencesTable/.test(f.code) && !SEQUENCE_TABLE_ALLOWLIST.has(f.rel),
    ).map((f) => f.rel);

    expect(
      offenders,
      `These read the sequence table directly instead of calling nextNumber() from ` +
        `lib/doc-number.ts. A second reader is a second engine: it will not hold the ` +
        `advisory lock, will not scope by company and will not reset yearly. ` +
        `Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("no route builds a business identifier from a timestamp or random value", () => {
    // The old fallback was `JV-${yyyymm}-${random}`. A number a machine invents
    // without a counter behind it is not an identifier — nothing stops a
    // collision and nothing makes it sortable.
    const offenders = FILES.filter((f) => f.rel.startsWith("routes/") || f.rel.startsWith("lib/"))
      .filter((f) => f.rel !== "lib/demo.ts" && f.rel !== "seed.ts")
      .filter((f) => /Math\.random\s*\(/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `Math.random() in a route or service. If this is a business identifier it ` +
        `must come from nextNumber(); if it is genuinely not, add the file here ` +
        `with the reason. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("no create endpoint lets the caller choose its own business number", () => {
    // The shape that let a client name its own invoice:
    //   const number = data.number ?? (await nextJournalNumber(...))
    //
    // Only `code` and `number` — an identifier the system owns. `reference` is
    // deliberately excluded: it holds the counterparty's document reference,
    // which nobody but the user can know, so `data.reference ?? null` is the
    // correct shape and flagging it would train people to ignore this test.
    const pattern = /\b(data|parsed\.data|body)\.(code|number)\s*\?\?/;
    const offenders = FILES.filter((f) => f.rel.startsWith("routes/"))
      .filter((f) => pattern.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `A client-supplied code/number is being used as a fallback for a generated ` +
        `one. The engine decides; whatever the client sent is discarded. ` +
        `Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("cross-cutting engines are not bypassed", () => {
  /** Routes that legitimately write nothing, or whose writes are not business rows. */
  const NO_AUDIT_EXPECTED = new Set([
    "routes/index.ts", // router mount only
    "routes/health.ts",
    "routes/dashboard.ts",
    "routes/bi.ts",
    "routes/audit.ts", // reads the audit log
    "routes/executive-oversight.ts",
    "routes/permission-inspector.ts",
    "routes/public-legal.ts", // public read surface
    "routes/secretariat.ts", // read-only desk over other registers
    "routes/portal.ts", // customer portal, audited through its own path
    "routes/testing.ts", // control plane, audits via recordAudit already
  ]);

  it("every writing route records an audit trail", () => {
    const offenders = FILES.filter((f) => f.rel.startsWith("routes/"))
      .filter((f) => !NO_AUDIT_EXPECTED.has(f.rel))
      .filter((f) => /\b(db|tx)\.(insert|update|delete)\(/.test(f.code))
      // registerCrud audits on the caller's behalf.
      .filter((f) => !/recordAudit/.test(f.code) && !/registerCrud/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `These write to the database without recordAudit() and without going ` +
        `through registerCrud, which audits for you. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("every route is behind authentication", () => {
    const PUBLIC = new Set([
      "routes/index.ts",
      "routes/health.ts",
      "routes/public-legal.ts",
      // Authorised by the signed handle in the URL rather than by middleware,
      // because the browser PUTs a file with no headers of its own — the same
      // reason cloud storage issues signed URLs. Without a valid, unexpired,
      // HMAC-signed handle the route does nothing, and a handle is only ever
      // issued to an authenticated caller.
      "routes/object-upload.ts",
    ]);
    const offenders = FILES.filter((f) => f.rel.startsWith("routes/"))
      .filter((f) => !PUBLIC.has(f.rel))
      .filter((f) => /router\.(get|post|patch|put|delete)\(/.test(f.code))
      .filter((f) => !/requireAuth|requirePermission|requireCustomerAuth/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `These expose endpoints with no auth middleware. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("request bodies are validated against the contract, not by hand", () => {
    /** Routes outside the generated client, with the reason. */
    const OUTSIDE_CONTRACT = new Set([
      "routes/index.ts",
      "routes/public-legal.ts",
      // Testing Mode's control plane: enter/exit/reset take no body at all, so
      // there is nothing for a contract schema to describe.
      "routes/testing.ts",
      // The body is the raw bytes of a file, streamed to disk. There is no
      // JSON shape for a schema to validate; the guard is the signed handle.
      "routes/object-upload.ts",
    ]);
    // `correspondence-internal.ts` used to sit here. It is now registered in
    // openapi.yaml and validates with the generated
    // `ComposeInternalCorrespondenceBody`, so the exception is gone rather
    // than merely documented — which is the point of keeping this list short.
    const offenders = FILES.filter((f) => f.rel.startsWith("routes/"))
      .filter((f) => !OUTSIDE_CONTRACT.has(f.rel))
      .filter((f) => /router\.(post|patch|put)\(/.test(f.code))
      .filter((f) => !/@workspace\/api-zod/.test(f.text))
      .map((f) => f.rel);

    expect(
      offenders,
      `These accept a request body without a schema from @workspace/api-zod. ` +
        `Schema validation belongs to the contract; only business rules belong ` +
        `in the handler. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("approval authority is decided in one place", () => {
  /** The module that owns the two rules, plus its own test. */
  const AUTHORITY_OWNER = new Set(["lib/approval-authority.ts"]);

  it("nothing else decides who may approve", () => {
    // Separation of duties written a second time is separation of duties that
    // can disagree with itself — and the copy that says "allowed" is the one
    // that will be reached first.
    const offenders = FILES.filter((f) => !AUTHORITY_OWNER.has(f.rel))
      .filter((f) => /requestedBy\s*===\s*\w*[Aa]pprover|approverId\s*===\s*\w*requested/i.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `These compare the requester against the approver themselves instead of ` +
        `calling canApprove() from lib/approval-authority.ts. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("nothing else reads the approval-limit setting", () => {
    // Naming the key is not the same as deciding with it. `routes/settings.ts`
    // seeds the row so the policy appears on the Settings page — a policy
    // nobody can see is a policy nobody will set — but it never parses the
    // value or compares an amount to it. What must stay in one place is the
    // *decision*: reading the limit and ruling on an approval.
    const SEEDS_ONLY = new Set(["routes/settings.ts"]);

    const offenders = FILES.filter((f) => !AUTHORITY_OWNER.has(f.rel))
      .filter((f) => !SEEDS_ONLY.has(f.rel))
      .filter((f) => /approvals\.limits/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `The approval-limit setting is read by lib/approval-authority.ts alone. ` +
        `Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("the settings registry only seeds the limit, it never interprets it", () => {
    // The exception above is only safe while it stays an exception: the moment
    // settings.ts starts parsing the value or comparing an amount to it, there
    // are two authorities on what an approver may approve.
    const settings = FILES.find((f) => f.rel === "routes/settings.ts");
    expect(settings).toBeDefined();
    expect(settings!.code).not.toMatch(/JSON\.parse[\s\S]{0,200}approvals\.limits/);
    expect(settings!.code).not.toMatch(/approvals\.limits[\s\S]{0,200}JSON\.parse/);
    expect(settings!.code).not.toMatch(/withinApprovalLimit|amountFromPayload/);
  });
});

describe("each business decision has one calculation", () => {
  /*
   * Five policies were decided by the business, and each is enforced by one
   * engine. The risk is not that the rule is wrong today — it is that someone
   * later computes the same thing beside it, in a screen or a report, and the
   * two answers drift apart without either being obviously wrong.
   *
   * Each rule below names the owner and the shape of a second implementation.
   */

  it("inventory value is decided only by the stock engine", () => {
    // The dashboard used to add up document headers and the BI report read its
    // own latest-row-per-item query. Both are gone; this keeps them gone.
    const owners = new Set(["lib/stock.ts"]);
    const offenders = FILES.filter((f) => !owners.has(f.rel))
      .filter((f) => /balance_value|balanceValue/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `These derive an inventory value of their own. Value is weighted average ` +
        `cost and comes from stockPosition()/valuedPositions()/inventoryValue() ` +
        `in lib/stock.ts. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("the over-receipt tolerance is stated once", () => {
    const owners = new Set(["lib/procurement-match.ts"]);
    const offenders = FILES.filter((f) => !owners.has(f.rel))
      .filter((f) => /OVER_RECEIPT_TOLERANCE/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `The over-receipt policy is zero and lives in lib/procurement-match.ts. ` +
        `Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("supplier and appraisal scores are computed in one module", () => {
    const owners = new Set(["lib/evaluation-score.ts"]);
    const offenders = FILES.filter((f) => !owners.has(f.rel))
      .filter((f) => /SUPPLIER_CRITERIA|supplierOverallScore|weightedScore\s*[:=]/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `A second weighted-score calculation. Both supplier and employee scoring ` +
        `belong to lib/evaluation-score.ts. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("the next service date is computed in one module", () => {
    const owners = new Set(["lib/fleet-service.ts"]);
    const offenders = FILES.filter((f) => !owners.has(f.rel))
      .filter((f) => /nextServiceDate\s*[:=]|computeServiceDue/.test(f.code))
      // The register hands the work to the engine; it does not do it.
      .filter((f) => !/applyNextServiceDate\(/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `A second service-schedule calculation. The rule is six months or the ` +
        `vehicle's own distance/hours limit, whichever comes first, in ` +
        `lib/fleet-service.ts. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("every decided policy is read from the settings registry, not hard-coded", () => {
    // The numbers themselves must not appear as literals in business logic:
    // a 10000 or a 0.30 written into a module is a policy that can no longer
    // be revised without a deploy, and a second place for it to disagree.
    const POLICY_LITERALS = [
      { name: "the approval ceiling", re: /\b10_?000\b/, allow: ["routes/settings.ts"] },
      { name: "a supplier weight", re: /\{\s*price:\s*30\b/, allow: ["routes/settings.ts"] },
    ];

    for (const policy of POLICY_LITERALS) {
      const offenders = FILES.filter((f) => f.rel.startsWith("lib/") || f.rel.startsWith("routes/"))
        .filter((f) => !policy.allow.includes(f.rel))
        .filter((f) => policy.re.test(f.code))
        .map((f) => f.rel);

      expect(
        offenders,
        `${policy.name} is written as a literal here. Policies are read from ` +
          `the settings registry so they can be revised. Offenders: ${offenders.join(", ")}`,
      ).toEqual([]);
    }
  });
});

describe("document lifecycles are declared in one place", () => {
  it("nothing else defines a transition table", () => {
    // A second transition map is a second answer to "what may this become",
    // and the two will disagree the first time a state is added to one of them.
    const offenders = FILES.filter((f) => f.rel !== "lib/lifecycle.ts")
      .filter((f) => /transitions:\s*\{|LIFECYCLES\s*[:=]\s*\{/.test(f.code))
      .map((f) => f.rel);

    expect(
      offenders,
      `These declare their own state-transition table instead of adding to ` +
        `LIFECYCLES in lib/lifecycle.ts. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("the rules can actually catch a violation", () => {
  // A guard that never fires is indistinguishable from a guard that cannot.
  // These run the same predicates over planted samples.
  it("detects a new direct reader of the sequence table", () => {
    const planted = { rel: "routes/invented.ts", text: "select().from(numberSequencesTable)" };
    const caught = /numberSequencesTable/.test(planted.text) &&
      !SEQUENCE_TABLE_ALLOWLIST.has(planted.rel);
    expect(caught).toBe(true);
  });

  it("detects a client-chosen business number", () => {
    const pattern = /\b(data|parsed\.data|body)\.(code|number|reference)\s*\?\?/;
    expect(pattern.test("const n = data.number ?? (await gen());")).toBe(true);
    expect(pattern.test("const n = await gen();")).toBe(false);
  });

  it("detects a random business identifier", () => {
    expect(/Math\.random\s*\(/.test("const r = Math.random();")).toBe(true);
  });
});
