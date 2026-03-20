/**
 * Cloudflare Worker: proxy https://api.prod.whoop.com with CORS so the Biotracker SPA on GitHub Pages
 * can exchange OAuth tokens and call the WHOOP Developer API from the browser.
 *
 * Deploy: https://developers.cloudflare.com/workers/get-started/guide/
 * 1. wrangler init whoop-proxy && replace src/index.js with this file (or paste into dashboard worker).
 * 2. wrangler deploy
 * 3. In your GitHub Actions workflow (or local build for Pages), set:
 *    VITE_WHOOP_API_PROXY=https://YOUR-SUBDOMAIN.workers.dev
 * 4. Rebuild and redeploy the site.
 *
 * Security: This forwards arbitrary paths to WHOOP; only deploy on an account you control. Do not add secrets here.
 */

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const target = new URL("https://api.prod.whoop.com");
    target.pathname = url.pathname;
    target.search = url.search;

    const headers = new Headers(request.headers);
    headers.delete("host");

    const init = {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "follow",
    };

    const res = await fetch(target.toString(), init);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders(request))) {
      headers.set(k, v);
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};

function corsHeaders(request) {
  const reqHdr = request.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": reqHdr || "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}
