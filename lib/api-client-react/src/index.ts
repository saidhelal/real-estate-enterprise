export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter, setTokenRefresher, setNextChangeReason } from "./custom-fetch";
// Endpoints outside the OpenAPI contract still belong on the same transport —
// the base URL, credentials, token refresh and change-reason handling all live
// in customFetch, and a second http helper in the web app would quietly miss
// every one of them.
export { customFetch } from "./custom-fetch";
export type { AuthTokenGetter, TokenRefresher } from "./custom-fetch";
