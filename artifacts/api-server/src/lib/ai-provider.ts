/**
 * Central AI provider wrapper. The rest of the codebase talks to the model
 * exclusively through these helpers so the underlying provider can be swapped
 * (OpenAI today, via the Replit AI integration) without touching routes.
 *
 * gpt-5 family models reject `temperature` and `max_tokens`; they take
 * `max_completion_tokens` instead. Keep that detail isolated here.
 *
 * The provider client is imported lazily: the integration module throws at
 * import time when its env vars are unset, so importing it eagerly would crash
 * the whole API server on boot whenever AI is unconfigured. Callers always gate
 * on `aiConfigured()` first (and respond 503), so the dynamic import only ever
 * runs when the integration is actually provisioned.
 */
export const AI_MODEL = process.env.AI_MODEL ?? "gpt-5";
const MAX_COMPLETION_TOKENS = 8192;

export type ChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** True when the AI integration is provisioned. */
export function aiConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  );
}

let _openaiPromise: Promise<
  typeof import("@workspace/integrations-openai-ai-server")["openai"]
> | null = null;

async function getOpenAI() {
  if (!_openaiPromise) {
    _openaiPromise = import("@workspace/integrations-openai-ai-server").then(
      (m) => m.openai,
    );
  }
  return _openaiPromise;
}

/**
 * Single-shot completion constrained to a JSON object. Returns the raw JSON
 * string from the model (callers parse + validate against a Zod schema).
 */
export async function aiCompleteJson(messages: ChatMsg[]): Promise<string> {
  const openai = await getOpenAI();
  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: { type: "json_object" },
    messages,
  });
  return res.choices[0]?.message?.content ?? "";
}

/**
 * Streaming chat completion. Yields incremental text chunks as they arrive so
 * callers can forward them over SSE.
 */
export async function* aiStreamText(
  messages: ChatMsg[],
): AsyncGenerator<string, void, unknown> {
  const openai = await getOpenAI();
  const stream = await openai.chat.completions.create({
    model: AI_MODEL,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    stream: true,
    messages,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
