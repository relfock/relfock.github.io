/**
 * WHOOP Developer API (OAuth 2.0 + data fetch).
 * @see https://developer.whoop.com/api
 */

/** User-facing OAuth login (must stay on WHOOP’s host). */
export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";

/** Set at runtime from saved settings (Settings → WHOOP) so GitHub Pages works without a rebuild. */
let runtimeWhoopApiProxyRoot = "";

/**
 * Call when WHOOP settings load or change. Empty string clears; build-time VITE_WHOOP_API_PROXY is used next.
 */
export function setWhoopApiProxyRoot(url) {
  runtimeWhoopApiProxyRoot = typeof url === "string" ? url.trim().replace(/\/$/, "") : "";
}

/**
 * API root for data + token POST. Order: saved proxy URL → VITE_WHOOP_API_PROXY → direct (often blocked by CORS on static hosts).
 * In dev, .env.development can set VITE_WHOOP_API_PROXY=/api/whoop (see vite.config.js).
 */
export function getWhoopApiRoot() {
  if (runtimeWhoopApiProxyRoot) return runtimeWhoopApiProxyRoot;
  const custom = (import.meta.env.VITE_WHOOP_API_PROXY || "").trim();
  if (custom) return custom.replace(/\/$/, "");
  return "https://api.prod.whoop.com";
}

/**
 * Absolute URL for WHOOP paths (/oauth/..., /developer/...). Required for fetch() when the proxy root is
 * a site-relative path (e.g. /api/whoop) and for token exchange on static hosts (see VITE_WHOOP_API_PROXY).
 */
export function buildWhoopApiUrl(path) {
  const root = (getWhoopApiRoot() || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const joined = `${root}${p}`;
  if (/^https?:\/\//i.test(joined)) return joined;
  if (typeof window === "undefined") return joined;
  return new URL(joined.startsWith("/") ? joined : `/${joined}`, window.location.origin).href;
}

export function getWhoopDeveloperBase() {
  return buildWhoopApiUrl("/developer");
}

export function getWhoopTokenUrl() {
  return buildWhoopApiUrl("/oauth/oauth2/token");
}

/** Scopes for recovery, sleep, strain, workouts, profile, body + refresh token */
export const WHOOP_SCOPES = [
  "offline",
  "read:recovery",
  "read:cycles",
  "read:workout",
  "read:sleep",
  "read:profile",
  "read:body_measurement",
].join(" ");

const PKCE_VERIFIER_KEY = "whoop_pkce_verifier";
const PKCE_STATE_KEY = "whoop_oauth_state";
const PKCE_PERSON_KEY = "whoop_oauth_person_id";

function base64Url(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** @returns {Promise<{ verifier: string, challenge: string }>} */
export async function createPkcePair() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const verifier = base64Url(arr);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));
  return { verifier, challenge };
}

export function randomState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

const PKCE_REDIRECT_KEY = "whoop_oauth_redirect_uri";

/**
 * Default redirect when the user has not set an explicit URI in settings.
 * Normalizes away ?code=… / hash and trailing index.html so it matches typical GitHub Pages + SPA setups.
 * WHOOP compares redirect_uri as an exact string — if this still doesn’t match, set an explicit URI in the app.
 *
 * For the **site root** (path `/` only), returns `origin` with **no trailing slash** (e.g. `https://user.github.io`).
 * That matches how most users register OAuth redirect URLs (browser bar + WHOOP dashboard) and avoids
 * mismatch with `https://user.github.io/` (slash vs no slash).
 */
export function resolveWhoopRedirectUri() {
  if (typeof window === "undefined") return "";
  const u = new URL(window.location.href);
  u.hash = "";
  u.search = "";
  let path = u.pathname || "/";
  if (path.endsWith("/index.html")) path = path.slice(0, -"index.html".length) || "/";
  if (path === "") path = "/";
  if (path === "/") return u.origin;
  return `${u.origin}${path}`;
}

/**
 * Normalize a redirect URI string so site-root URLs use one canonical form (origin only, no trailing slash).
 */
export function canonicalWhoopRedirectUri(uri) {
  const s = (uri || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.pathname === "/" && !u.search && !u.hash) return u.origin;
    return u.href;
  } catch {
    return s;
  }
}

/**
 * Final redirect_uri for OAuth (authorize + token). Order: saved override → VITE_WHOOP_REDIRECT_URI → current page.
 * Must match a Redirect URL in the WHOOP app exactly (character-for-character).
 */
export function getWhoopRedirectUri(explicitOverride) {
  const t = (explicitOverride || "").trim();
  if (t) return canonicalWhoopRedirectUri(t);
  const env = (import.meta.env.VITE_WHOOP_REDIRECT_URI || "").trim();
  if (env) return canonicalWhoopRedirectUri(env);
  return canonicalWhoopRedirectUri(resolveWhoopRedirectUri());
}

/**
 * @param {object} p
 * @param {string} p.clientId
 * @param {string} p.redirectUri
 * @param {string} p.state
 * @param {string} p.codeChallenge
 */
export function buildWhoopAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
  const u = new URL(WHOOP_AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", WHOOP_SCOPES);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export function storeWhoopPkceSession(verifier, state, personId, redirectUri) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);
  sessionStorage.setItem(PKCE_PERSON_KEY, personId);
  if (redirectUri) sessionStorage.setItem(PKCE_REDIRECT_KEY, redirectUri);
}

export function readWhoopPkceSession() {
  if (typeof sessionStorage === "undefined") {
    return { verifier: null, state: null, personId: null, redirectUri: null };
  }
  return {
    verifier: sessionStorage.getItem(PKCE_VERIFIER_KEY),
    state: sessionStorage.getItem(PKCE_STATE_KEY),
    personId: sessionStorage.getItem(PKCE_PERSON_KEY),
    redirectUri: sessionStorage.getItem(PKCE_REDIRECT_KEY),
  };
}

export function clearWhoopPkceSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_PERSON_KEY);
  sessionStorage.removeItem(PKCE_REDIRECT_KEY);
}

/**
 * @param {object} p
 * @param {string} p.code
 * @param {string} p.redirectUri
 * @param {string} p.clientId
 * @param {string} p.codeVerifier
 * @param {string} [p.clientSecret]
 */
export async function exchangeWhoopCode(p) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: p.code,
    redirect_uri: p.redirectUri,
    client_id: p.clientId,
    code_verifier: p.codeVerifier,
  });
  if (p.clientSecret) body.set("client_secret", p.clientSecret);

  const res = await fetch(getWhoopTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.error_description || data.error || data.message || text || res.statusText;
    throw new Error(`WHOOP token exchange failed (${res.status}): ${msg}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
  };
}

/**
 * @param {object} p
 * @param {string} p.refreshToken
 * @param {string} p.clientId
 * @param {string} [p.clientSecret]
 */
export async function refreshWhoopToken(p) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: p.refreshToken,
    client_id: p.clientId,
    scope: "offline",
  });
  if (p.clientSecret) body.set("client_secret", p.clientSecret);

  const res = await fetch(getWhoopTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.error_description || data.error || data.message || text || res.statusText;
    throw new Error(`WHOOP token refresh failed (${res.status}): ${msg}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? p.refreshToken,
    expires_in: data.expires_in,
  };
}

/**
 * Absolute request URL for WHOOP developer API. Relative bases (e.g. /api/whoop from Vite proxy) cannot use new URL(singleString).
 */
function buildWhoopDeveloperRequestUrl(path, query = {}) {
  const root = getWhoopDeveloperBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const joined = `${root}${p}`;
  let u;
  if (/^https?:\/\//i.test(joined)) {
    u = new URL(joined);
  } else {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    u = new URL(joined.startsWith("/") ? joined : `/${joined}`, origin);
  }
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/** @param {string} accessToken */
async function whoopFetchJson(path, accessToken, query = {}) {
  const href = buildWhoopDeveloperRequestUrl(path, query);
  const res = await fetch(href, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    let err;
    try {
      err = JSON.parse(text);
    } catch {
      err = { message: text };
    }
    const msg = err.message || err.error || text || res.statusText;
    throw new Error(`WHOOP API ${path}: ${res.status} ${msg}`);
  }
  if (!text.trim()) return null;
  return JSON.parse(text);
}

/**
 * Paginated collection (recovery, sleep, cycle, workout).
 * @param {string} path e.g. /v2/recovery
 * @param {string} accessToken
 * @param {string | null | undefined} startIso — If falsy, `start` is omitted (full paginated history per API).
 * @param {number} [maxPages]
 */
export async function fetchWhoopCollection(path, accessToken, startIso, maxPages = 500) {
  const records = [];
  let nextToken = null;
  let pages = 0;
  while (pages < maxPages) {
    const query = { limit: 25 };
    if (startIso) query.start = startIso;
    if (nextToken) query.nextToken = nextToken;
    const data = await whoopFetchJson(path, accessToken, query);
    const batch = data?.records;
    if (Array.isArray(batch)) records.push(...batch);
    nextToken = data?.next_token || null;
    if (!nextToken) break;
    pages += 1;
  }
  return records;
}

function whoopRecordKey(r) {
  if (r && r.id != null && String(r.id) !== "") return `id:${r.id}`;
  return `k:${r?.start || ""}|${r?.created_at || ""}|${r?.end || ""}`;
}

function mergeRecordLists(prev, next) {
  const m = new Map();
  for (const r of prev || []) m.set(whoopRecordKey(r), r);
  for (const r of next || []) m.set(whoopRecordKey(r), r);
  return [...m.values()];
}

const byCreatedDesc = (a, b) =>
  new Date(b.created_at || b.start || 0).getTime() - new Date(a.created_at || a.start || 0).getTime();

/**
 * Merge a partial or full WHOOP fetch into an existing cache so incremental syncs do not drop older rows.
 * @param {object | null | undefined} prev
 * @param {object} incoming — result of syncWhoopDataset
 */
export function mergeWhoopSnapshot(prev, incoming) {
  if (!incoming || typeof incoming !== "object") return prev || null;
  if (!prev || typeof prev !== "object") return { ...incoming };
  return {
    syncedAt: incoming.syncedAt,
    recoveries: mergeRecordLists(prev.recoveries, incoming.recoveries).sort(byCreatedDesc),
    sleeps: mergeRecordLists(prev.sleeps, incoming.sleeps).sort(byCreatedDesc),
    cycles: mergeRecordLists(prev.cycles, incoming.cycles).sort(byCreatedDesc),
    workouts: mergeRecordLists(prev.workouts, incoming.workouts).sort(byCreatedDesc),
    profile: incoming.profile ?? prev.profile ?? null,
    body: incoming.body ?? prev.body ?? null,
  };
}

/**
 * Ensure a valid access token; refresh if expired or near expiry.
 * @param {object} tokenRec { accessToken, refreshToken, expiresAtMs }
 * @param {string} clientId
 * @param {string} [clientSecret]
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAtMs: number }>}
 */
export async function ensureWhoopAccessToken(tokenRec, clientId, clientSecret) {
  const now = Date.now();
  const skew = 60_000;
  if (tokenRec.accessToken && tokenRec.expiresAtMs && tokenRec.expiresAtMs > now + skew) {
    return {
      accessToken: tokenRec.accessToken,
      refreshToken: tokenRec.refreshToken,
      expiresAtMs: tokenRec.expiresAtMs,
    };
  }
  if (!tokenRec.refreshToken) {
    throw new Error("WHOOP session expired. Connect WHOOP again.");
  }
  const refreshed = await refreshWhoopToken({
    refreshToken: tokenRec.refreshToken,
    clientId,
    clientSecret,
  });
  const expiresAtMs = now + (Number(refreshed.expires_in) || 3600) * 1000;
  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAtMs,
  };
}

/**
 * Pull WHOOP data for the authenticated user.
 * @param {string} accessToken
 * @param {object} [options]
 * @param {string | null} [options.startIso] — If omitted or null, `start` is not sent (paginate through all history the API returns). If a date string, only records from that instant onward.
 * @param {number} [options.maxPages=500] — Max paginated requests per collection.
 */
export async function syncWhoopDataset(accessToken, options = {}) {
  const maxPages = options.maxPages != null ? options.maxPages : 500;
  const startIso = options.startIso === undefined ? null : options.startIso;
  const headers = accessToken;
  const [recoveries, sleeps, cycles, workouts, profile, body] = await Promise.all([
    fetchWhoopCollection("/v2/recovery", headers, startIso, maxPages),
    fetchWhoopCollection("/v2/activity/sleep", headers, startIso, maxPages),
    fetchWhoopCollection("/v2/cycle", headers, startIso, maxPages),
    fetchWhoopCollection("/v2/activity/workout", headers, startIso, maxPages),
    whoopFetchJson("/v2/user/profile/basic", headers).catch(() => null),
    whoopFetchJson("/v2/user/measurement/body", headers).catch(() => null),
  ]);
  return {
    syncedAt: new Date().toISOString(),
    recoveries: [...recoveries].sort(byCreatedDesc),
    sleeps: [...sleeps].sort(byCreatedDesc),
    cycles: [...cycles].sort(byCreatedDesc),
    workouts: [...workouts].sort(byCreatedDesc),
    profile,
    body,
  };
}

export function millisToHm(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min}m`;
  return `${h}h ${min}m`;
}

export function celsiusToDisplay(c) {
  if (c == null || Number.isNaN(c)) return "—";
  return `${Number(c).toFixed(1)} °C`;
}

export function coerceWhoopTokenRecord(rec) {
  if (!rec || typeof rec !== "object") return { accessToken: "", refreshToken: "", expiresAtMs: 0 };
  return {
    accessToken: String(rec.accessToken || rec.access_token || ""),
    refreshToken: String(rec.refreshToken || rec.refresh_token || ""),
    expiresAtMs: Number(rec.expiresAtMs || rec.expires_at_ms || 0) || 0,
  };
}

export function normalizeWhoopSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return { clientId: "", clientSecret: "", redirectUri: "", apiProxyUrl: "", tokensByPersonId: {} };
  }
  const tokensByPersonId = {};
  if (raw.tokensByPersonId && typeof raw.tokensByPersonId === "object") {
    for (const [pid, rec] of Object.entries(raw.tokensByPersonId)) {
      tokensByPersonId[pid] = coerceWhoopTokenRecord(rec);
    }
  }
  return {
    clientId: String(raw.clientId || ""),
    clientSecret: String(raw.clientSecret || ""),
    redirectUri: String(raw.redirectUri || ""),
    apiProxyUrl: String(raw.apiProxyUrl || "").trim(),
    tokensByPersonId,
  };
}
