/**
 * Central AI provider wrapper. The rest of the codebase talks to the model
 * exclusively through these helpers so the underlying provider AND model can be
 * swapped from System Settings (`ai.provider` / `ai.model`) without touching any
 * route.
 *
 * Every supported provider is reached through an OpenAI-compatible Chat
 * Completions endpoint, whatever serves it. A provider is
 * therefore just a `(baseURL, apiKey)` pair sourced from its own
 * `AI_INTEGRATIONS_<PROVIDER>_*` env vars; selecting one only changes which
 * client we build. New providers are added to `AI_PROVIDERS` — no route change.
 *
 * gpt-5 family models reject `temperature` and `max_tokens`; they take
 * `max_completion_tokens` instead. Keep that detail isolated here.
 *
 * Clients are constructed lazily (and cached) only when a call is actually made
 * and the selected provider is configured, so an unconfigured provider can never
 * crash the API server on boot. Callers gate on `aiConfigured()` (→ 503) first.
 */
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

/** System-settings keys holding the admin-selected provider/model. */
export const AI_PROVIDER_SETTING_KEY = "ai.provider";
export const AI_MODEL_SETTING_KEY = "ai.model";

/**
 * Fallbacks used when the matching system setting is empty/missing or the
 * settings table is unreachable. The `AI_PROVIDER` / `AI_MODEL` env vars still
 * override the hard-coded defaults so a deployment can pin them without the DB.
 */
export const DEFAULT_AI_PROVIDER = "openai";
export const DEFAULT_AI_MODEL = process.env.AI_MODEL ?? "gpt-5";

/**
 * Allowlist of selectable providers. `envPrefix` names the integration env var
 * pair (`<prefix>_BASE_URL` + `<prefix>_API_KEY`) pointing at that provider's
 * endpoint. Nothing here is tied to a particular host: set the pair to the
 * vendor API directly, or to any compatible gateway.
 */
export const AI_PROVIDERS = {
  openai: { label: "OpenAI", envPrefix: "AI_INTEGRATIONS_OPENAI" },
  openrouter: { label: "OpenRouter", envPrefix: "AI_INTEGRATIONS_OPENROUTER" },
  gemini: { label: "Gemini", envPrefix: "AI_INTEGRATIONS_GEMINI" },
} as const;

export type AiProviderId = keyof typeof AI_PROVIDERS;

const ENV_DEFAULT_PROVIDER = process.env.AI_PROVIDER ?? DEFAULT_AI_PROVIDER;

const MAX_COMPLETION_TOKENS = 8192;

export type ChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function isAiProviderId(value: string): value is AiProviderId {
  return Object.prototype.hasOwnProperty.call(AI_PROVIDERS, value);
}

function providerEnv(id: AiProviderId): {
  baseURL: string | undefined;
  apiKey: string | undefined;
} {
  const prefix = AI_PROVIDERS[id].envPrefix;
  return {
    baseURL: process.env[`${prefix}_BASE_URL`],
    apiKey: process.env[`${prefix}_API_KEY`],
  };
}

/** True when the given provider's integration env vars are both present. */
export function providerConfigured(id: AiProviderId): boolean {
  const { baseURL, apiKey } = providerEnv(id);
  return Boolean(baseURL && apiKey);
}

/** Read a single setting value, trimmed; null on missing/empty/DB error. */
async function readSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, key))
      .limit(1);
    const value = row?.value?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the active provider from the `ai.provider` system setting, letting
 * admins swap providers from the Settings page without a code change. Falls back
 * to the env/default when the setting is empty/missing/unknown so a bad row can
 * never take the assistant offline.
 */
export async function resolveAiProvider(): Promise<AiProviderId> {
  const value = await readSetting(AI_PROVIDER_SETTING_KEY);
  if (value && isAiProviderId(value)) return value;
  if (isAiProviderId(ENV_DEFAULT_PROVIDER)) return ENV_DEFAULT_PROVIDER;
  return DEFAULT_AI_PROVIDER;
}

/**
 * Resolve the active model from the `ai.model` system setting. Falls back to
 * `DEFAULT_AI_MODEL` when empty/missing or the DB read fails.
 */
export async function resolveAiModel(): Promise<string> {
  return (await readSetting(AI_MODEL_SETTING_KEY)) ?? DEFAULT_AI_MODEL;
}

/** True when the currently-selected provider is provisioned. */
export async function aiConfigured(): Promise<boolean> {
  return providerConfigured(await resolveAiProvider());
}

const _clients = new Map<AiProviderId, OpenAI>();

/** Build (and cache) an OpenAI-compatible client for the given provider. */
function getClient(id: AiProviderId): OpenAI {
  const cached = _clients.get(id);
  if (cached) return cached;
  const { baseURL, apiKey } = providerEnv(id);
  if (!baseURL || !apiKey) {
    throw new Error(`AI provider "${id}" is not configured.`);
  }
  const client = new OpenAI({ apiKey, baseURL });
  _clients.set(id, client);
  return client;
}

/** Resolve the active provider + model and return a ready client. */
async function activeClient(): Promise<{ client: OpenAI; model: string }> {
  const [provider, model] = await Promise.all([
    resolveAiProvider(),
    resolveAiModel(),
  ]);
  return { client: getClient(provider), model };
}

/**
 * Single-shot completion constrained to a JSON object. Returns the raw JSON
 * string from the model (callers parse + validate against a Zod schema).
 */
export async function aiCompleteJson(messages: ChatMsg[]): Promise<string> {
  const { client, model } = await activeClient();
  const res = await client.chat.completions.create({
    model,
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
  const { client, model } = await activeClient();
  const stream = await client.chat.completions.create({
    model,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    stream: true,
    messages,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
