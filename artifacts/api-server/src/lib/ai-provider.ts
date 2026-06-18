import { openai } from "@workspace/integrations-openai-ai-server";

/**
 * Central AI provider wrapper. The rest of the codebase talks to the model
 * exclusively through these helpers so the underlying provider can be swapped
 * (OpenAI today, via the Replit AI integration) without touching routes.
 *
 * gpt-5 family models reject `temperature` and `max_tokens`; they take
 * `max_completion_tokens` instead. Keep that detail isolated here.
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

/**
 * Single-shot completion constrained to a JSON object. Returns the raw JSON
 * string from the model (callers parse + validate against a Zod schema).
 */
export async function aiCompleteJson(messages: ChatMsg[]): Promise<string> {
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
