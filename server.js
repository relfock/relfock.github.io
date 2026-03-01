import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      people: Array.isArray(data.people) ? data.people : [],
      entries: data.entries && typeof data.entries === "object" ? data.entries : {},
    };
  } catch {
    return { people: [], entries: {} };
  }
}

function writeStore(people, entries) {
  ensureDataDir();
  fs.writeFileSync(
    STORE_FILE,
    JSON.stringify({ people, entries }, null, 2),
    "utf8"
  );
}

const app = express();
app.use(express.json({ limit: "2mb" }));

// Allow all origins so any browser/client can sync (dev proxy or same-host deploy)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/data", (req, res) => {
  try {
    const data = readStore();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Persist both people and entries to data/store.json (single source of truth)
app.post("/api/data", (req, res) => {
  try {
    const { people, entries } = req.body;
    const safePeople = Array.isArray(people) ? people : [];
    const safeEntries = entries && typeof entries === "object" ? entries : {};
    writeStore(safePeople, safeEntries);
    res.json({ ok: true, people: safePeople, entries: safeEntries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Biotracker data server at http://localhost:${PORT} (LAN: http://<this-pc-ip>:${PORT})`);
});
