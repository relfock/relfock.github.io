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

Open http://localhost:5173. Copy `.env.example` to `.env` for API keys (PDF import / chat) if needed.

Optional: set `VITE_API_BASE` to a URL that implements `POST /api/fetch-url` if you want chat to read arbitrary links (browser-only builds hit CORS on most sites).
