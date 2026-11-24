import "server-only";
import OpenAI from "openai";

/**
 * The currently configured model endpoint: an Azure APIM gateway exposing an
 * OpenAI-compatible `/v1` surface (not a direct OpenAI account, and not Azure
 * OpenAI Service's own `/openai/deployments/{id}?api-version=...` shape).
 * Pointing this at a different OpenAI-compatible provider means changing
 * BASE_URL and the auth header below; see docs/ARCHITECTURE.md.
 */
const BASE_URL = "https://apim-key-access-imgpt-prod.azure-api.net/openai/v1/";

/**
 * The gateway authenticates via a plain `api-key` header, not the SDK's
 * default `Authorization: Bearer <key>` scheme. The constructor requires a
 * truthy `apiKey` regardless (it throws "Missing credentials" otherwise,
 * checked before any request is made, independently of defaultHeaders) -
 * confirmed against this SDK version's source rather than assumed. So the
 * real key is passed as both `apiKey` (which still makes the SDK send an
 * `Authorization: Bearer <key>` header - harmless, since APIM only checks
 * `api-key` and ignores headers it doesn't recognise) and, explicitly, as
 * `api-key` via `defaultHeaders`, which is the one the gateway actually
 * validates.
 */
export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  return new OpenAI({
    baseURL: BASE_URL,
    apiKey,
    defaultHeaders: { "api-key": apiKey },
  });
}
