# biotracker
Dashboard for tracking biomarkers. Data stays in **localStorage**, optional **Google Drive** sync, or **import/export** backups—no backend required.

## GitHub Pages

**Vite + React** static site. On push to `main`, Actions builds and publishes `dist`.

1. **Settings → Pages → Source: GitHub Actions**
2. Site: `https://<user>.github.io/` (or your custom domain)

Add **authorized JavaScript origins** in Google Cloud for your Pages URL if you use Drive sync.

## Run locally

```bash
npm install
npm run dev
```

Run commands from the **repo root** (the folder that contains `package.json`), not from `src/`. Open http://localhost:5173. Copy `.env.example` to `.env` for API keys (PDF import / chat) if needed.

**Published site is blank:** In the browser, open DevTools → Network and reload; if `index-*.js` is red (404), redeploy after the latest push (build uses relative `./assets/…` so it works for both `user.github.io` and project subpaths). Confirm **Settings → Pages** uses **GitHub Actions**, not an empty branch folder.

Optional: set `VITE_API_BASE` to a URL that implements `POST /api/fetch-url` if you want chat to read arbitrary links (browser-only builds hit CORS on most sites).
