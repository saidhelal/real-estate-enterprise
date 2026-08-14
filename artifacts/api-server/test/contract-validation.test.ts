import { describe, it, expect } from "vitest";
import { ComposeInternalCorrespondenceBody } from "@workspace/api-zod";

/**
 * Internal correspondence validates against the contract.
 *
 * This module was the last route validating its request body outside
 * `openapi.yaml` — first with hand-written `if` chains, then with a local zod
 * schema. Both were a second place the shape was written down. These assert
 * that the generated schema is now the one doing the work, and that it
 * actually rejects the shapes the old checks rejected.
 */
describe("compose correspondence is validated by the generated contract", () => {
  it("rejects a body with no subject", () => {
    expect(ComposeInternalCorrespondenceBody.safeParse({ companyId: "c1" }).success).toBe(false);
  });

  it("rejects a body with no companyId", () => {
    expect(ComposeInternalCorrespondenceBody.safeParse({ subject: "Hello" }).success).toBe(false);
  });

  it("rejects a field of the wrong type", () => {
    const r = ComposeInternalCorrespondenceBody.safeParse({
      companyId: "c1",
      subject: "Hello",
      send: "yes",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a well-formed draft", () => {
    expect(
      ComposeInternalCorrespondenceBody.safeParse({ companyId: "c1", subject: "Hello" }).success,
    ).toBe(true);
  });

  it("accepts a send with recipients and an idempotency key", () => {
    const r = ComposeInternalCorrespondenceBody.safeParse({
      companyId: "c1",
      subject: "Hello",
      to: ["e1"],
      cc: ["e2"],
      send: true,
      idempotencyKey: "k1",
    });
    expect(r.success).toBe(true);
  });

  it("leaves the recipient rule to the service", () => {
    // A draft may have no recipient; sending may not. That depends on what the
    // request is trying to do, so the schema must not decide it.
    expect(
      ComposeInternalCorrespondenceBody.safeParse({ companyId: "c1", subject: "Hi", send: true })
        .success,
    ).toBe(true);
  });
});
