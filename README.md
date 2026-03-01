# biotracker
Dashboard for tracking biomarkers. Data is stored on the server and shared across all browsers/sessions.

## Run (dev)

1. **Start the data server** (stores people and entries in `data/store.json`):
   ```bash
   npm run server
   ```
2. **Start the app** (in another terminal):
   ```bash
   npm run dev
   ```
3. Open http://localhost:5173. Any import or manual entry is saved to the server; all clients see the same data.
