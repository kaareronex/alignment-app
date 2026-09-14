import "server-only";
import OpenAI from "openai";

/**
 * Implement's internal Azure APIM gateway, not a direct OpenAI account -
 * this is an OpenAI-compatible `/v1` surface fronted by APIM, not Azure
 * OpenAI Service's own `/openai/deployments/{id}?api-version=...` shape.
 * See CLAUDE.md for the key's expiry/budget - both are meaningfully
 * tighter than the previous direct Anthropic setup and worth watching.
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
