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

const MAX_FETCH_CHARS = 16_000;
const FETCH_TIMEOUT_MS = 20_000;
const MIN_CONTENT_LENGTH = 400;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,nb;q=0.8",
};

function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  let s = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<\/tr>/gi, "\n").replace(/<\/td>|<\/th>/gi, "\t");
  s = s.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
  s = s.replace(/\s+/g, " ").replace(/\n\s+/g, "\n").replace(/\t+/g, "\t").trim();
  return s.slice(0, MAX_FETCH_CHARS);
}

app.post("/api/fetch-url", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url" });
    }
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return res.status(400).json({ error: "Invalid url" });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(trimmed, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return res.status(400).json({ error: `HTTP ${response.status}` });
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    let text = await response.text();
    if (contentType.includes("text/html")) {
      text = stripHtml(text);
    } else {
      text = text.replace(/\s+/g, " ").trim().slice(0, MAX_FETCH_CHARS);
    }
    const usable = (text || "").trim();
    if (usable.length < MIN_CONTENT_LENGTH) {
      return res.status(200).json({
        error: "This page’s content is likely loaded by JavaScript and could not be read. Please copy the table or relevant text from the page and paste it here.",
      });
    }
    res.json({ text: usable });
  } catch (err) {
    const message = err.name === "AbortError" ? "Request timed out" : err.message || "Fetch failed";
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Biotracker data server at http://localhost:${PORT} (LAN: http://<this-pc-ip>:${PORT})`);
});
