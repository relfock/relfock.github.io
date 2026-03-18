/** Max text length injected into chat context. */
const MAX_CHARS = 16_000;
const MIN_CONTENT_LENGTH = 400;
const FETCH_TIMEOUT_MS = 20_000;

function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  let s = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<\/tr>/gi, "\n").replace(/<\/td>|<\/th>/gi, "\t");
  s = s.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
  s = s.replace(/\s+/g, " ").replace(/\n\s+/g, "\n").replace(/\t+/g, "\t").trim();
  return s.slice(0, MAX_CHARS);
}

/**
 * Fetches page text for chat URL context.
 * With VITE_API_BASE, calls POST {base}/api/fetch-url (optional self-hosted proxy).
 * Otherwise uses browser fetch (often blocked by CORS for third-party URLs).
 * @param {string} url
 * @returns {Promise<{ text?: string, error?: string }>}
 */
export async function fetchUrlContentForChat(url) {
  const apiBase = (import.meta.env.VITE_API_BASE || "").trim().replace(/\/$/, "");
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/fetch-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && typeof data === "object" && (data.text || data.error)) {
        return { text: data.text, error: data.error };
      }
      return { error: data?.error || `Unexpected response (${res.status})` };
    } catch (err) {
      const message = err?.message || "network error";
      return { error: message };
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal, mode: "cors" });
    clearTimeout(timeout);
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    let text = await response.text();
    if (contentType.includes("text/html")) {
      text = stripHtml(text);
    } else {
      text = text.replace(/\s+/g, " ").trim();
    }
    const usable = (text || "").trim().slice(0, MAX_CHARS);
    if (usable.length < MIN_CONTENT_LENGTH) {
      return {
        error:
          "This page’s content is likely loaded by JavaScript and could not be read. Please copy the table or relevant text from the page and paste it here.",
      };
    }
    return { text: usable };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { error: "Request timed out" };
    }
    const isCorsOrNetwork =
      err?.name === "TypeError" ||
      String(err?.message || "").toLowerCase().includes("failed to fetch");
    if (isCorsOrNetwork) {
      return {
        error:
          "Cannot read this URL from the browser (CORS). Copy the text from the page and paste it here, or set VITE_API_BASE to a server that exposes POST /api/fetch-url.",
      };
    }
    return { error: err?.message || "Fetch failed" };
  }
}
