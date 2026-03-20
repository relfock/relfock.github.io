import { useState, useEffect, useCallback, useRef } from "react";
import { BIOMARKER_DB } from "./src/data/biomarkerDb.js";
import {
  CATEGORIES,
  DERIVED_BIOMARKERS,
  getBiomarkersForPerson,
  computeDerivedBiomarkers,
  getCalculatedFrom,
  getMissingDerivedSources,
} from "./src/data/derivedBiomarkers.js";
import { parseLabValue } from "./src/utils/parseLabValue.js";
import { getStatus, statusColor, higherIsBetter, statusBg } from "./src/utils/rangeStatus.js";
import {
  RANGE_COLORS,
  RANGE_BG,
  RANGE_BAR_FILL,
  RANGE_RGB,
  MONITOR_FREQUENCY_LABELS,
} from "./src/constants/rangeColors.js";
import { normalizeExtractedBiomarkerKeys } from "./src/constants/importAliases.js";
import { INIT_PEOPLE, THEME_STORAGE_KEY, THEME_COLORS } from "./src/constants/theme.js";
import { MonitorFrequencyBadge } from "./src/components/MonitorFrequencyBadge.jsx";
import { buildRangeBar, RangeBarSegments } from "./src/components/RangeBar.jsx";
import { TrendDetail } from "./src/components/TrendDetail.jsx";
import { FitnessWhoopView } from "./src/components/FitnessWhoopView.jsx";
import { WhoopTrendDetail } from "./src/components/WhoopTrendDetail.jsx";
import {
  buildWhoopAuthorizeUrl,
  clearWhoopPkceSession,
  createPkcePair,
  exchangeWhoopCode,
  ensureWhoopAccessToken,
  getWhoopRedirectUri,
  mergeWhoopSnapshot,
  normalizeWhoopSettings,
  resolveWhoopRedirectUri,
  randomState,
  readWhoopPkceSession,
  storeWhoopPkceSession,
  syncWhoopDataset,
} from "./src/lib/whoop.js";
import { parseNorwegianAnalysehistorikk } from "./src/parsers/norwegian.js";
import { nameAndSurnameMatch, AI_PROVIDERS, AI_PROVIDER_FREE_TIER } from "./src/lib/importHelpers.js";
import { pdfToImages } from "./src/lib/pdfUtils.js";
import { getOrCreateAppData, updateDataFile } from "./src/lib/googleDrive.js";
import { requestDriveToken } from "./src/lib/googleAuth.js";

/** Pull API keys from backup JSON (settings.apiKeys, apiKeys, VITE_* at root, alternate casing). */
function apiKeysFromBackupData(data) {
  const out = { gemini: "", anthropic: "", openai: "", groq: "" };
  const set = (p, v) => {
    const s = v == null ? "" : String(v).trim();
    if (s) out[p] = s;
  };
  const fromObj = (obj) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj)) {
      const kk = String(k).toLowerCase();
      const s = v == null ? "" : String(v).trim();
      if (!s) continue;
      if (kk === "gemini" || kk === "vite_gemini_api_key" || kk === "google_ai" || kk === "google") set("gemini", s);
      else if (kk === "anthropic" || kk === "vite_anthropic_api_key" || kk === "claude") set("anthropic", s);
      else if (kk === "openai" || kk === "vite_openai_api_key" || kk === "chatgpt") set("openai", s);
      else if (kk === "groq" || kk === "vite_groq_api_key") set("groq", s);
    }
  };
  /** Direct copy of known provider keys (handles exact keys from our export). */
  const mergeProviderBlock = (block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return;
    for (const p of ["gemini", "anthropic", "openai", "groq"]) {
      if (block[p] != null && String(block[p]).trim()) set(p, block[p]);
    }
  };

  let st = data?.settings ?? data?.Settings;
  if (typeof st === "string") {
    try {
      st = JSON.parse(st);
    } catch {
      st = null;
    }
  }
  if (st && typeof st === "object" && !Array.isArray(st)) {
    mergeProviderBlock(st.apiKeys);
    mergeProviderBlock(st.APIKeys);
    mergeProviderBlock(st.api_keys);
    fromObj(st.apiKeys);
    fromObj(st.APIKeys);
    fromObj(st.api_keys);
  }
  fromObj(data?.apiKeys);
  fromObj(data?.APIKeys);
  set("gemini", data?.VITE_GEMINI_API_KEY);
  set("anthropic", data?.VITE_ANTHROPIC_API_KEY);
  set("openai", data?.VITE_OPENAI_API_KEY);
  set("groq", data?.VITE_GROQ_API_KEY);
  return out;
}

/** Merge WHOOP OAuth settings from backup JSON (settings.whoop, whoopSettings, or flat keys). */
function whoopFromBackupData(data) {
  let st = data?.settings;
  if (typeof st === "string") {
    try {
      st = JSON.parse(st);
    } catch {
      st = null;
    }
  }
  let w = st?.whoop;
  if (typeof w === "string") {
    try {
      w = JSON.parse(w);
    } catch {
      w = null;
    }
  }
  if (w && typeof w === "object" && !Array.isArray(w)) {
    return normalizeWhoopSettings(w);
  }
  if (data?.whoopSettings && typeof data.whoopSettings === "object" && !Array.isArray(data.whoopSettings)) {
    return normalizeWhoopSettings(data.whoopSettings);
  }
  const flat = {
    clientId: data?.whoopClientId ?? data?.VITE_WHOOP_CLIENT_ID,
    clientSecret: data?.whoopClientSecret ?? data?.VITE_WHOOP_CLIENT_SECRET,
    redirectUri: data?.whoopRedirectUri ?? data?.VITE_WHOOP_REDIRECT_URI,
  };
  const hasFlat = [flat.clientId, flat.clientSecret, flat.redirectUri].some((x) => x != null && String(x).trim() !== "");
  if (hasFlat) {
    return normalizeWhoopSettings({
      ...flat,
      tokensByPersonId: {},
    });
  }
  return normalizeWhoopSettings(null);
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [people, setPeople] = useState(INIT_PEOPLE);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [entries, setEntries] = useState({});
  const [view, setView] = useState("biomarkers");
  const [selectedBiomarker, setSelectedBiomarker] = useState(null);
  const [selectedFitnessMarker, setSelectedFitnessMarker] = useState(null);
  const [viewBeforeTrendDetail, setViewBeforeTrendDetail] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetPersonId, setImportTargetPersonId] = useState(null);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterRecord, setFilterRecord] = useState("all"); // "all" | "noRecord"
  const [biomarkersViewMode, setBiomarkersViewMode] = useState("table"); // "cards" | "table"
  const [biomarkersTableSort, setBiomarkersTableSort] = useState({ by: "name", dir: "asc" });
  const [historyTableSort, setHistoryTableSort] = useState({ by: "name", dir: "asc" });
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState(null);
  const [driveStatus, setDriveStatus] = useState("disconnected");
  const [driveToken, setDriveToken] = useState(null);
  const [driveFileId, setDriveFileId] = useState(null);
  const [apiKeysFromDrive, setApiKeysFromDrive] = useState({});
  const [driveLoadError, setDriveLoadError] = useState(null);
  const [skipDrive, setSkipDrive] = useState(false);
  const [driveSigningIn, setDriveSigningIn] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [apiKeysDraft, setApiKeysDraft] = useState({});
  const [apiKeyVisible, setApiKeyVisible] = useState({});
  const [whoopClientSecretVisible, setWhoopClientSecretVisible] = useState(false);
  const [backupImportMessage, setBackupImportMessage] = useState(null);
  const importBackupInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [viewOriginalFile, setViewOriginalFile] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(null); // person id pending deletion
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showEditPersonModal, setShowEditPersonModal] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatConversations, setChatConversations] = useState(() => [{ id: 1, messages: [] }]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [chatProvider, setChatProvider] = useState("groq");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatWaitSeconds, setChatWaitSeconds] = useState(null);
  const [chatPlayingId, setChatPlayingId] = useState(null);
  const [chatAtOpen, setChatAtOpen] = useState(false);
  const [chatAtPrefix, setChatAtPrefix] = useState("");
  const [chatAtIndex, setChatAtIndex] = useState(0);
  const [chatAttachedFiles, setChatAttachedFiles] = useState([]);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatWindowRect, setChatWindowRect] = useState(() => {
    if (typeof window === "undefined") return { x: 100, y: 100, w: 540, h: 420 };
    const w = Math.min(560, window.innerWidth - 40);
    const h = Math.min(440, window.innerHeight - 80);
    return { x: Math.max(0, (window.innerWidth - w) / 2), y: Math.max(0, (window.innerHeight - h) / 2), w, h };
  });
  const chatDragStart = useRef(null);
  const chatResizeStart = useRef(null);
  const chatInputRef = useRef(null);
  const chatAtListRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(THEME_STORAGE_KEY) || "dark");
  });

  const [whoopSettings, setWhoopSettings] = useState(() => normalizeWhoopSettings(null));
  const [whoopCache, setWhoopCache] = useState({});
  const [whoopCredentialsDraft, setWhoopCredentialsDraft] = useState({ clientId: "", clientSecret: "", redirectUri: "" });
  const [whoopSyncState, setWhoopSyncState] = useState({ status: "idle", message: "" });
  const whoopSettingsRef = useRef(whoopSettings);
  whoopSettingsRef.current = whoopSettings;

  const themeColors = THEME_COLORS[theme];

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColors.appBg);
  }, [theme, themeColors.appBg]);

  useEffect(() => {
    if (view === "trends" && !selectedBiomarker) setView("biomarkers");
  }, [view, selectedBiomarker]);

  const getAge = (person) => {
    if (person.birthday) {
      const today = new Date();
      const birth = new Date(person.birthday + "T12:00:00");
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    }
    return person.age || null;
  };

  const getBirthdayDisplay = (person) => {
    if (!person.birthday) return null;
    return new Date(person.birthday + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  // In-memory fallback when window.storage (e.g. extension) is not available
  const storage = typeof window !== "undefined" && window.storage
    ? window.storage
    : {
        get: async (key) => {
          try {
            const v = localStorage.getItem(key);
            return v != null ? { value: v } : null;
          } catch {
            return null;
          }
        },
        set: async (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (_) {}
        },
      };

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

  const getApiKey = useCallback((provider) => {
    const key = (apiKeysFromDrive[provider] || "").trim();
    if (key) return key;
    const envMap = { anthropic: "VITE_ANTHROPIC_API_KEY", openai: "VITE_OPENAI_API_KEY", groq: "VITE_GROQ_API_KEY", gemini: "VITE_GEMINI_API_KEY" };
    return ((import.meta.env[envMap[provider]] || "")).trim();
  }, [apiKeysFromDrive]);

  // Load: Google Drive (when signed in) or localStorage only. No server; data comes from imported backup or previous local/Drive save.
  useEffect(() => {
    const init = async () => {
      if (googleClientId && !skipDrive) {
        const storedToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("biotracker-drive-token") : null;
        const storedFileId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("biotracker-drive-fileId") : null;
        if (storedToken) {
          setDriveToken(storedToken);
          try {
            const { fileId, data } = await getOrCreateAppData(storedToken);
            setDriveFileId(fileId);
            setPeople(data.people);
            setEntries(data.entries);
            setApiKeysFromDrive(data.settings?.apiKeys || {});
            setWhoopSettings(normalizeWhoopSettings(data.settings?.whoop));
            setWhoopCache(data.whoopCache && typeof data.whoopCache === "object" ? data.whoopCache : {});
            setDriveStatus("connected");
            setDriveLoadError(null);
            if (data.people?.length) setSelectedPerson(data.people[0].id);
            if (typeof sessionStorage !== "undefined") sessionStorage.setItem("biotracker-drive-fileId", fileId);
          } catch (e) {
            const msg = e?.message || "Failed to load from Drive";
            if (msg.includes("401") || msg.includes("Token expired") || msg.includes("invalid")) {
              if (typeof sessionStorage !== "undefined") {
                sessionStorage.removeItem("biotracker-drive-token");
                sessionStorage.removeItem("biotracker-drive-fileId");
              }
              setDriveToken(null);
              setDriveFileId(null);
              setDriveLoadError("Session expired. Sign in again.");
            } else {
              setDriveLoadError(msg);
            }
          }
        }
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const pr = await storage.get("bloodwork-people");
        const en = await storage.get("bloodwork-entries");
        if (pr && pr.value) {
          const parsedPeople = JSON.parse(pr.value);
          setPeople(Array.isArray(parsedPeople) ? parsedPeople : []);
          setSelectedPerson(parsedPeople?.[0]?.id ?? null);
        }
        if (en && en.value) {
          const parsedEntries = JSON.parse(en.value);
          setEntries(parsedEntries && typeof parsedEntries === "object" ? parsedEntries : {});
        }
        const wh = await storage.get("bloodwork-whoop");
        if (wh?.value) {
          try {
            const o = JSON.parse(wh.value);
            setWhoopSettings(normalizeWhoopSettings(o.settings));
            if (o.cache && typeof o.cache === "object") setWhoopCache(o.cache);
          } catch (_) {}
        }
        const storedKeys = typeof localStorage !== "undefined" ? localStorage.getItem("biotracker-api-keys") : null;
        if (storedKeys) {
          try {
            const parsed = JSON.parse(storedKeys);
            if (parsed && typeof parsed === "object") setApiKeysFromDrive(parsed);
          } catch (_) {}
        }
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, [googleClientId, skipDrive]);

  // Keep selectedPerson valid when people list changes (add/delete)
  useEffect(() => {
    if (people.length === 0) setSelectedPerson(null);
    else if (!selectedPerson || !people.some((p) => p.id === selectedPerson)) setSelectedPerson(people[0].id);
  }, [people]);

  // Save: Drive when connected, otherwise localStorage only. No server; data stays local or in your Drive.
  // options.apiKeysOverride: when saving from API keys modal, pass the new keys.
  // options.whoopSettingsOverride / whoopCacheOverride: optional WHOOP persistence.
  const save = async (newPeople, newEntries, options = {}) => {
    setSaveError(null);
    const keysToSave = options.apiKeysOverride ?? apiKeysFromDrive;
    const nextWhoop = options.whoopSettingsOverride !== undefined ? options.whoopSettingsOverride : whoopSettings;
    const nextWhoopCache = options.whoopCacheOverride !== undefined ? options.whoopCacheOverride : whoopCache;

    if (driveToken && driveFileId) {
      try {
        await updateDataFile(driveToken, driveFileId, {
          people: newPeople,
          entries: newEntries,
          settings: { apiKeys: keysToSave, whoop: nextWhoop },
          whoopCache: nextWhoopCache,
        });
        setPeople(newPeople);
        setEntries(newEntries);
        setWhoopSettings(nextWhoop);
        setWhoopCache(nextWhoopCache);
        setApiKeysFromDrive(keysToSave);
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("biotracker-api-keys", JSON.stringify(keysToSave));
          } catch (_) {}
        }
        setSaveError(null);
      } catch (e) {
        const msg = e?.message || "Drive save failed";
        setSaveError(msg);
        if (msg.includes("401") || msg.includes("Token expired") || msg.includes("invalid")) {
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("biotracker-drive-token");
            sessionStorage.removeItem("biotracker-drive-fileId");
          }
          setDriveToken(null);
          setDriveFileId(null);
          setDriveStatus("disconnected");
        }
      }
      return;
    }

    try {
      await storage.set("bloodwork-people", JSON.stringify(newPeople));
      await storage.set("bloodwork-entries", JSON.stringify(newEntries));
      await storage.set("bloodwork-whoop", JSON.stringify({ settings: nextWhoop, cache: nextWhoopCache }));
      setPeople(newPeople);
      setEntries(newEntries);
      setWhoopSettings(nextWhoop);
      setWhoopCache(nextWhoopCache);
      if (options.apiKeysOverride != null) {
        setApiKeysFromDrive(options.apiKeysOverride);
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("biotracker-api-keys", JSON.stringify(options.apiKeysOverride));
          } catch (_) {}
        }
      }
      setSaveError(null);
    } catch (e) {
      setSaveError(e?.message || "Failed to save locally");
    }
  };

  /** OAuth return: ?code=&state= (Redirect URL must match this page URL exactly) */
  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;
    const { verifier, state: storedState, personId, redirectUri: storedRedirect } = readWhoopPkceSession();
    if (!verifier || !storedState || state !== storedState || !personId) return;

    let cancelled = false;
    (async () => {
      try {
        let ws = { ...normalizeWhoopSettings(whoopSettingsRef.current) };
        if (!ws.clientId) {
          try {
            const raw = localStorage.getItem("bloodwork-whoop");
            if (raw) {
              const o = JSON.parse(raw);
              ws = { ...ws, ...normalizeWhoopSettings(o.settings) };
            }
          } catch (_) {}
        }
        const clientId = (ws.clientId || import.meta.env.VITE_WHOOP_CLIENT_ID || "").trim();
        const clientSecret = (ws.clientSecret || import.meta.env.VITE_WHOOP_CLIENT_SECRET || "").trim();
        if (!clientId) throw new Error("Missing WHOOP Client ID — add it in Settings → API keys & WHOOP, then try Connect again.");
        const redirectUri =
          (storedRedirect && String(storedRedirect).trim()) || getWhoopRedirectUri(ws.redirectUri);
        const tokens = await exchangeWhoopCode({
          code,
          redirectUri,
          clientId,
          codeVerifier: verifier,
          clientSecret: clientSecret || undefined,
        });
        if (cancelled) return;
        clearWhoopPkceSession();
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, "", url.toString());

        const expiresAtMs = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
        const nextWhoop = {
          ...ws,
          tokensByPersonId: {
            ...ws.tokensByPersonId,
            [personId]: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token || "",
              expiresAtMs,
            },
          },
        };
        await save(people, entries, { whoopSettingsOverride: nextWhoop });
        setSelectedPerson(personId);
        setWhoopSyncState({ status: "ok", message: "WHOOP connected. Syncing your data…" });
        setSelectedFitnessMarker(null);
        setView("fitness");
      } catch (e) {
        if (cancelled) return;
        clearWhoopPkceSession();
        try {
          const url = new URL(window.location.href);
          url.search = "";
          window.history.replaceState({}, "", url.toString());
        } catch (_) {}
        setWhoopSyncState({ status: "error", message: e?.message || "WHOOP connection failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, people, entries]);

  useEffect(() => {
    if (view !== "fitness") return;
    setWhoopCredentialsDraft({
      clientId: whoopSettings.clientId || (import.meta.env.VITE_WHOOP_CLIENT_ID || "").trim(),
      clientSecret: whoopSettings.clientSecret || "",
      redirectUri: whoopSettings.redirectUri || "",
    });
  }, [view, whoopSettings.clientId, whoopSettings.clientSecret, whoopSettings.redirectUri]);

  const addEntry = (personId, date, biomarkers, extractedName = null, extractedNameEnglish = null, importedFile = null) => {
    const newEntries = {
      ...entries,
      [personId]: [...(entries[personId] || []), { date, biomarkers, id: Date.now(), extractedName: extractedName || undefined, extractedNameEnglish: extractedNameEnglish || undefined, importedFile: importedFile || undefined }]
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    };
    setEntries(newEntries);
    save(people, newEntries);
  };

  const deleteEntry = (personId, entryId) => {
    const newEntries = {
      ...entries,
      [personId]: (entries[personId] || []).filter(e => e.id !== entryId),
    };
    setEntries(newEntries);
    save(people, newEntries);
  };

  const addPerson = (person) => {
    const newPeople = [...people, { ...person, id: String(Date.now()), avatar: person.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() }];
    setPeople(newPeople);
    setSelectedPerson(newPeople[newPeople.length - 1].id);
    save(newPeople, entries);
    setShowAddPersonModal(false);
  };

  const updatePerson = (personId, updates) => {
    const newPeople = people.map(p =>
      p.id !== personId
        ? p
        : {
            ...p,
            ...updates,
            id: p.id,
            avatar: (updates.name ?? p.name).trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase() || p.avatar,
          }
    );
    setPeople(newPeople);
    save(newPeople, entries);
  };

  const deletePerson = (personId) => {
    const newPeople = people.filter(p => p.id !== personId);
    const newEntries = { ...entries };
    delete newEntries[personId];
    const nextWhoop = {
      ...whoopSettings,
      tokensByPersonId: { ...whoopSettings.tokensByPersonId },
    };
    delete nextWhoop.tokensByPersonId[personId];
    const nextWhoopCache = { ...whoopCache };
    delete nextWhoopCache[personId];
    setPeople(newPeople);
    setEntries(newEntries);
    setWhoopSettings(nextWhoop);
    setWhoopCache(nextWhoopCache);
    save(newPeople, newEntries, { whoopSettingsOverride: nextWhoop, whoopCacheOverride: nextWhoopCache });
    if (selectedPerson === personId) setSelectedPerson(newPeople[0]?.id || null);
    setConfirmDeletePerson(null);
  };

  const whoopCacheRef = useRef(whoopCache);
  whoopCacheRef.current = whoopCache;

  const runWhoopSync = async (quiet = false) => {
    if (!selectedPerson) return;
    const ws = whoopSettingsRef.current;
    const tokenRec = ws.tokensByPersonId?.[selectedPerson];
    if (!tokenRec?.accessToken && !tokenRec?.refreshToken) return;
    if (!quiet) setWhoopSyncState((prev) => (prev.status === "loading" ? prev : { status: "loading", message: "" }));
    try {
      const clientId = (ws.clientId || import.meta.env.VITE_WHOOP_CLIENT_ID || "").trim();
      const clientSecret = (ws.clientSecret || import.meta.env.VITE_WHOOP_CLIENT_SECRET || "").trim();
      if (!clientId) throw new Error("Missing WHOOP Client ID");
      const fresh = await ensureWhoopAccessToken(
        {
          accessToken: tokenRec.accessToken,
          refreshToken: tokenRec.refreshToken,
          expiresAtMs: tokenRec.expiresAtMs,
        },
        clientId,
        clientSecret || undefined
      );
      const nextWhoop = {
        ...ws,
        tokensByPersonId: {
          ...ws.tokensByPersonId,
          [selectedPerson]: {
            accessToken: fresh.accessToken,
            refreshToken: fresh.refreshToken,
            expiresAtMs: fresh.expiresAtMs,
          },
        },
      };
      const prevSnap = whoopCacheRef.current[selectedPerson];
      const incremental = quiet && Boolean(prevSnap?.syncedAt);
      const syncOpts = incremental
        ? { startIso: new Date(Date.now() - 90 * 86400000).toISOString(), maxPages: 120 }
        : { startIso: null, maxPages: 500 };
      const incoming = await syncWhoopDataset(fresh.accessToken, syncOpts);
      const data = mergeWhoopSnapshot(prevSnap, incoming);
      const nextCache = { ...whoopCacheRef.current, [selectedPerson]: data };
      await save(people, entries, { whoopSettingsOverride: nextWhoop, whoopCacheOverride: nextCache });
      if (!quiet) setWhoopSyncState({ status: "ok", message: "Synced successfully." });
    } catch (e) {
      if (!quiet) setWhoopSyncState({ status: "error", message: e?.message || "Sync failed" });
    }
  };

  const beginWhoopOAuth = async () => {
    setWhoopSyncState({ status: "idle", message: "" });
    const clientId = (
      whoopCredentialsDraft.clientId.trim() ||
      whoopSettings.clientId.trim() ||
      import.meta.env.VITE_WHOOP_CLIENT_ID ||
      ""
    ).trim();
    if (!clientId) {
      setWhoopSyncState({
        status: "error",
        message: "Enter and save a WHOOP Client ID (or set VITE_WHOOP_CLIENT_ID for builds).",
      });
      return;
    }
    if (!selectedPerson) return;
    try {
      const { verifier, challenge } = await createPkcePair();
      const state = randomState();
      const redirectUri = getWhoopRedirectUri((whoopCredentialsDraft.redirectUri || whoopSettings.redirectUri).trim());
      if (!redirectUri) {
        setWhoopSyncState({ status: "error", message: "Could not determine redirect URI for OAuth." });
        return;
      }
      storeWhoopPkceSession(verifier, state, selectedPerson, redirectUri);
      window.location.assign(buildWhoopAuthorizeUrl({ clientId, redirectUri, state, codeChallenge: challenge }));
    } catch (e) {
      setWhoopSyncState({ status: "error", message: e?.message || "Could not start WHOOP login" });
    }
  };

  const disconnectWhoop = () => {
    if (!selectedPerson) return;
    const next = {
      ...whoopSettings,
      tokensByPersonId: { ...whoopSettings.tokensByPersonId },
    };
    delete next.tokensByPersonId[selectedPerson];
    setWhoopSyncState({ status: "idle", message: "" });
    save(people, entries, { whoopSettingsOverride: next });
  };

  const openApiKeysModal = useCallback(() => {
    setApiKeysDraft({
      gemini: apiKeysFromDrive.gemini ?? "",
      anthropic: apiKeysFromDrive.anthropic ?? "",
      openai: apiKeysFromDrive.openai ?? "",
      groq: apiKeysFromDrive.groq ?? "",
    });
    setWhoopCredentialsDraft({
      clientId: whoopSettings.clientId || (import.meta.env.VITE_WHOOP_CLIENT_ID || "").trim(),
      clientSecret: whoopSettings.clientSecret || "",
      redirectUri: whoopSettings.redirectUri || "",
    });
    setWhoopClientSecretVisible(false);
    setApiKeyVisible({});
    setShowApiKeysModal(true);
  }, [apiKeysFromDrive, whoopSettings]);

  const whoopEffectiveRedirectUri = getWhoopRedirectUri((whoopCredentialsDraft.redirectUri || whoopSettings.redirectUri).trim());

  const runWhoopSyncRef = useRef(runWhoopSync);
  runWhoopSyncRef.current = runWhoopSync;

  useEffect(() => {
    if (view !== "fitness") setSelectedFitnessMarker(null);
  }, [view]);

  useEffect(() => {
    setSelectedFitnessMarker(null);
  }, [selectedPerson]);

  const whoopAutoFetchRef = useRef({});
  useEffect(() => {
    if (view !== "fitness") {
      whoopAutoFetchRef.current = {};
      return;
    }
    if (!selectedPerson || loading) return;
    const tokenRec = whoopSettingsRef.current.tokensByPersonId?.[selectedPerson];
    if (!tokenRec?.refreshToken && !tokenRec?.accessToken) return;
    const c = whoopCacheRef.current[selectedPerson];
    if (c?.syncedAt) return;
    if (whoopAutoFetchRef.current[selectedPerson]) return;
    whoopAutoFetchRef.current[selectedPerson] = true;
    void runWhoopSync(true);
  }, [view, selectedPerson, loading]);

  /** Background refresh while Fitness tab is open (keeps data fresh without blocking UI). */
  useEffect(() => {
    if (view !== "fitness" || !selectedPerson) return;
    const tok = whoopSettingsRef.current.tokensByPersonId?.[selectedPerson];
    if (!tok?.refreshToken && !tok?.accessToken) return;
    const id = window.setInterval(() => {
      void runWhoopSyncRef.current(true);
    }, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [view, selectedPerson]);

  const currentPerson = people.find(p => p.id === selectedPerson);
  const personEntries = entries[selectedPerson] || [];
  const latestEntry = personEntries[personEntries.length - 1];

  const allBiomarkers = getBiomarkersForPerson(currentPerson);

  const getTrend = (name) => {
    const vals = personEntries.map(e => e.biomarkers?.[name]).filter(v => v !== undefined);
    if (vals.length < 2) return null;
    const last = parseLabValue(vals[vals.length - 1]).numeric;
    const prev = parseLabValue(vals[vals.length - 2]).numeric;
    if (isNaN(last) || isNaN(prev)) return null;
    if (last > prev * 1.02) return "up";
    if (last < prev * 0.98) return "down";
    return "stable";
  };

  // Cumulative snapshot: for each biomarker, the most recent measured value across ALL entries
  const getCumulativeSnapshot = () => {
    const snapshot = {}; // { biomarkerName: { val, date } }
    // personEntries are sorted oldest→newest; include derived biomarkers computed per entry
    personEntries.forEach(entry => {
      const withDerived = computeDerivedBiomarkers(entry.biomarkers || {});
      Object.entries(withDerived).forEach(([name, val]) => {
        snapshot[name] = { val, date: entry.date };
      });
    });
    return snapshot;
  };

  const cumulativeSnapshot = getCumulativeSnapshot();

  const hasNoRecord = (name) => !cumulativeSnapshot[name];
  const noRecordCount = allBiomarkers.filter(hasNoRecord).length;
  const totalBiomarkersCount = allBiomarkers.length;

  const matchesStatusFilter = (name) => {
    if (!statusFilter) return true;
    const snap = cumulativeSnapshot[name];
    if (!snap || snap.val === undefined) return false;
    const s = getStatus(name, snap.val);
    return statusFilter === "high" ? (s === "high" || s === "out-of-range") : s === statusFilter;
  };

  const filteredBiomarkers = allBiomarkers.filter(b => {
    const cat = BIOMARKER_DB[b].category;
    const matchCat = filterCat === "All" || cat === filterCat;
    const matchSearch = !searchTerm || b.toLowerCase().includes(searchTerm.toLowerCase()) || cat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRecord = filterRecord === "all" || (filterRecord === "noRecord" && hasNoRecord(b));
    return matchCat && matchSearch && matchRecord && matchesStatusFilter(b);
  });

  const getStatusCounts = () => {
    const counts = { optimal: 0, sufficient: 0, high: 0, low: 0, elite: 0, total: 0 };
    Object.entries(cumulativeSnapshot).forEach(([name, { val }]) => {
      const s = getStatus(name, val);
      if (s === "optimal") counts.optimal++;
      else if (s === "sufficient") counts.sufficient++;
      else if (s === "elite") counts.elite++;
      else if (s === "high" || s === "out-of-range") counts.high++;
      else if (s === "low") counts.low++;
      counts.total++;
    });
    return counts;
  };

  const counts = getStatusCounts();
  const healthScore = counts.total > 0 ? Math.round((counts.optimal + counts.elite + counts.sufficient * 0.5) / counts.total * 100) : null;

  const navBiomarkersActive = view === "biomarkers" || (view === "trends" && viewBeforeTrendDetail !== "history");
  const navHistoryActive = view === "history" || (view === "trends" && viewBeforeTrendDetail === "history");
  const categorySidebarActive = view === "biomarkers" || (view === "trends" && viewBeforeTrendDetail === "biomarkers");

  const findBiomarkerKey = (name) => {
    const n = (name || "").trim();
    if (!n) return null;
    const lower = n.toLowerCase();
    const exact = Object.keys(BIOMARKER_DB).find((k) => k.toLowerCase() === lower);
    if (exact) return exact;
    return Object.keys(BIOMARKER_DB).find((k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) || null;
  };

  const chatAtSuggestionsList = [
    "@all",
    "@all_wtrends",
    "@person",
    "@norecord",
    ...CATEGORIES.flatMap((c) => [`@${c}`, `@${c}_wtrends`]),
    ...allBiomarkers.flatMap((b) => [`@${b}`, `@${b}_wtrend`]),
  ];
  const chatAtFiltered = chatAtPrefix === "" ? chatAtSuggestionsList : chatAtSuggestionsList.filter((s) => s.toLowerCase().slice(1).startsWith(chatAtPrefix.toLowerCase()));

  const handleChatInputChange = (e) => {
    const v = e.target.value;
    const pos = e.target.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const atPos = before.lastIndexOf("@");
    setChatInput(v);
    if (atPos !== -1 && (pos === atPos + 1 || /^[\w\s]*$/.test(before.slice(atPos + 1)))) {
      setChatAtPrefix(before.slice(atPos + 1, pos));
      setChatAtOpen(true);
      setChatAtIndex(0);
    } else {
      setChatAtOpen(false);
    }
  };

  const applyChatAtSuggestion = (suggestion) => {
    const el = chatInputRef.current;
    if (!el) return;
    const v = chatInput;
    const pos = el.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const atPos = before.lastIndexOf("@");
    if (atPos === -1) return;
    const newVal = v.slice(0, atPos) + suggestion + " " + v.slice(pos);
    setChatInput(newVal);
    setChatAtOpen(false);
    setTimeout(() => {
      el.focus();
      const newPos = atPos + suggestion.length + 1;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleChatKeyDown = (e) => {
    if (chatAtOpen && chatAtFiltered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setChatAtIndex((i) => (i + 1) % chatAtFiltered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setChatAtIndex((i) => (i - 1 + chatAtFiltered.length) % chatAtFiltered.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        applyChatAtSuggestion(chatAtFiltered[chatAtIndex]);
        return;
      }
      if (e.key === "Escape") {
        setChatAtOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  useEffect(() => {
    if (!showChatPanel) return;
    const onMove = (e) => {
      if (chatDragStart.current) {
        const { startX, startY } = chatDragStart.current;
        setChatWindowRect((r) => ({
          ...r,
          x: Math.max(0, r.x + e.clientX - startX),
          y: Math.max(0, r.y + e.clientY - startY),
        }));
        chatDragStart.current = { ...chatDragStart.current, startX: e.clientX, startY: e.clientY };
      }
      if (chatResizeStart.current) {
        const { startW, startH, startX, startY } = chatResizeStart.current;
        const w = Math.max(320, Math.min(window.innerWidth - 20, startW + e.clientX - startX));
        const h = Math.max(280, Math.min(window.innerHeight - 60, startH + e.clientY - startY));
        setChatWindowRect((r) => ({ ...r, w, h }));
        chatResizeStart.current = { startW: w, startH: h, startX: e.clientX, startY: e.clientY };
      }
    };
    const onUp = () => {
      chatDragStart.current = null;
      chatResizeStart.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [showChatPanel]);

  useEffect(() => {
    if (chatInput === "" && chatInputRef.current) {
      chatInputRef.current.style.height = "auto";
    }
  }, [chatInput]);

  const buildChatContext = (text, snapshot, entriesList, includePersonName, personBiomarkerKeys = null) => {
    const lines = [];
    const addBiomarkerLine = (key, withTrend) => {
      const meta = BIOMARKER_DB[key];
      const unit = meta?.unit ?? "";
      const freq = meta?.monitorFrequency ?? "6mo";
      const snap = snapshot[key];
      if (!snap) {
        lines.push(`${key}: no data (recommended check: every ${freq})`);
        return;
      }
      const status = getStatus(key, snap.val);
      lines.push(`${key}: ${snap.val} ${unit} (as of ${snap.date}) — ${status}; recheck every ${freq}`);
      if (withTrend && entriesList.length > 0) {
        const trendPoints = entriesList
          .map((e) => {
            const withDerived = computeDerivedBiomarkers(e.biomarkers || {});
            const v = withDerived[key];
            return v !== undefined ? { date: e.date, value: v } : null;
          })
          .filter(Boolean);
        if (trendPoints.length > 0) {
          lines.push(`  Trend: ${trendPoints.map((p) => `${p.date}=${p.value}`).join(" → ")}`);
        }
      }
    };
    const allKeys = Object.keys(BIOMARKER_DB);
    const keysForPerson = personBiomarkerKeys && personBiomarkerKeys.length > 0 ? personBiomarkerKeys : allKeys;
    const catLower = (c) => c.toLowerCase();
    const hasAll = /\@all\b/.test(text) && !/\@all_wtrends\b/.test(text);
    const hasAllWtrends = /\@all_wtrends\b/.test(text);
    const categoryWtrends = [...text.matchAll(/\@([^@]+?)_wtrends\b/gi)].map((m) => m[1].trim());
    const categoryOnly = [...text.matchAll(/\@([^@]+?)(?=\s|$|@)/g)].map((m) => m[1].trim()).filter((s) => {
      if (s === "all" || s.toLowerCase() === "all_wtrends" || s.toLowerCase() === "norecord") return false;
      if (s.endsWith("_wtrends") || s.endsWith("_wtrend")) return false;
      return true;
    });
    const sortedKeys = [...keysForPerson].sort((a, b) => b.length - a.length);
    const biomarkerOnlySet = new Set();
    const biomarkerWtrendSet = new Set();
    const restLower = text.toLowerCase();
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== "@") continue;
      const rest = text.slice(i + 1);
      const restLo = restLower.slice(i + 1);
      let matched = false;
      for (const key of sortedKeys) {
        const keyLo = key.toLowerCase();
        const afterKey = rest.length > key.length ? rest[key.length] : "";
        const wordBoundary = rest.length === key.length || /[\s@,.\])]/.test(afterKey);
        const wtrendSuffix = "_wtrend";
        if (restLo.startsWith(keyLo + wtrendSuffix) && (rest.length === key.length + 7 || /[\s@,.\])]/.test(rest[key.length + 7]))) {
          biomarkerWtrendSet.add(key);
          matched = true;
          break;
        }
        if (restLo.startsWith(keyLo) && wordBoundary) {
          biomarkerOnlySet.add(key);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      const wtrendMatch = restLo.match(/^(.+?)_wtrend(?=[\s@,.\])]|$)/);
      const token = wtrendMatch ? rest.slice(0, wtrendMatch[1].length).trim() : rest.match(/^[^\s@,.\])]+/)?.[0]?.trim() ?? rest.trim().split(/[\s@,.\])]/)[0]?.trim() ?? "";
      const wantWtrend = !!wtrendMatch;
      if (token) {
        const resolved = findBiomarkerKey(token);
        if (resolved && keysForPerson.includes(resolved)) {
          if (wantWtrend) biomarkerWtrendSet.add(resolved);
          else biomarkerOnlySet.add(resolved);
        }
      }
    }
    const biomarkerOnly = [...biomarkerOnlySet];
    const biomarkerWtrend = [...biomarkerWtrendSet];
    const categoriesMentioned = categoryOnly.filter((s) => CATEGORIES.some((c) => catLower(c) === s.toLowerCase()));
    const categoryWtrendsMentioned = categoryWtrends.filter((s) => CATEGORIES.some((c) => catLower(c) === s.toLowerCase()));

    if (includePersonName) lines.push(`Patient (explicitly shared by user): ${includePersonName}\n`);
    const hasNorecord = /\@norecord\b/.test(text);
    if (hasNorecord) {
      const noDataKeys = keysForPerson.filter((k) => !snapshot[k]);
      if (noDataKeys.length > 0) {
        const withFreq = noDataKeys.map((k) => {
          const freq = BIOMARKER_DB[k]?.monitorFrequency ?? "6mo";
          return `${k} (recheck every ${freq})`;
        });
        lines.push(`Biomarkers with no data yet: ${withFreq.join("; ")}\n`);
      }
    }
    if (hasAll || hasAllWtrends) {
      const keysToShow = keysForPerson.filter((k) => snapshot[k]);
      keysToShow.forEach((k) => addBiomarkerLine(k, hasAllWtrends));
    }
    categoriesMentioned.forEach((catName) => {
      const cat = CATEGORIES.find((c) => catLower(c) === catName.toLowerCase());
      if (!cat) return;
      const keysInCat = keysForPerson.filter((k) => BIOMARKER_DB[k]?.category === cat && snapshot[k]);
      if (keysInCat.length > 0) lines.push(`\n[${cat}]`);
      keysInCat.forEach((k) => addBiomarkerLine(k, false));
    });
    categoryWtrendsMentioned.forEach((catName) => {
      const cat = CATEGORIES.find((c) => catLower(c) === catName.toLowerCase());
      if (!cat) return;
      const keysInCat = keysForPerson.filter((k) => BIOMARKER_DB[k]?.category === cat && snapshot[k]);
      if (keysInCat.length > 0) lines.push(`\n[${cat} — with trends]`);
      keysInCat.forEach((k) => addBiomarkerLine(k, true));
    });
    biomarkerOnly.forEach((key) => addBiomarkerLine(key, false));
    biomarkerWtrend.forEach((key) => addBiomarkerLine(key, true));
    return lines.length > 0 ? lines.join("\n") : null;
  };

  const formatChatReply = (raw) => {
    if (typeof raw !== "string") return "";
    const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let out = escape(raw);
    out = out.replace(/\*\*\*([^*]+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    out = out.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
    out = out.replace(/\n/g, "<br />");
    return out;
  };

  const sendChatMessage = async () => {
    const text = (chatInput || "").trim();
    if (!text || chatLoading) return;
    const isDev = import.meta.env.DEV;
    const includePersonDetails = currentPerson && /\@(person|name)\b/i.test(text)
      ? (currentPerson.name + (currentPerson.birthday ? ", DOB " + getBirthdayDisplay(currentPerson) : ""))
      : null;
    const contextBlock = currentPerson && buildChatContext(text, cumulativeSnapshot, personEntries, includePersonDetails, allBiomarkers);
    const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
    const urlMatches = text.match(urlRegex) || [];
    const uniqueUrls = [...new Set(urlMatches.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
    const useNativeLinkTool = chatProvider === "groq-compound";
    let urlContent = "";
    if (!useNativeLinkTool) {
      const { fetchUrlContentForChat } = await import("./src/utils/fetchUrlContent.js");
      for (const url of uniqueUrls) {
        const data = await fetchUrlContentForChat(url);
        if (data.text) urlContent += `\n\n--- Content from ${url} ---\n\n${data.text}`;
        else if (data.error) urlContent += `\n\n[Could not fetch ${url}: ${data.error}]`;
      }
    }
    const linkBlock = urlContent ? `[Content from linked page(s):]${urlContent}\n\n` : "";
    const userContent = contextBlock
      ? `[Biomarker context shared in this conversation:\n${contextBlock}]\n\n${linkBlock}User question: ${text}`
      : linkBlock
        ? `${linkBlock}User question: ${text}`
        : text;
    const userMsg = { role: "user", content: userContent, displayContent: text };
    const activeMessages = chatConversations.find((c) => c.id === activeChatId)?.messages ?? [];
    setChatConversations((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, userMsg] } : c))
    );
    setChatInput("");
    setChatAttachedFiles([]);
    setChatLoading(true);
    const messagesForApi = [...activeMessages, userMsg].map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : m.content }));
    const systemPrompt = "You are a helpful health and biomarker assistant. Use only the biomarker data that the user has shared in this conversation (via @ mentions). Do not refer to, infer, or request names, birth dates, or other personal details unless the user has explicitly shared them (e.g. with @person). When the user provides biomarker data in [context], use it to answer. Be concise and accurate. If units or reference ranges are mentioned, use them. Format responses in plain text; avoid markdown asterisks for emphasis where possible, or use them consistently. When the user includes a link, content from that page may be provided in [Content from linked page(s)]; use it to answer. If you see [Could not fetch <url>: ...] then the fetch failed or the page could not be read; tell the user in a short, friendly way and use the exact suggestion from that message (e.g. to copy the table or text and paste it here) rather than rephrasing.";
    try {
      let reply = "";
      if (chatProvider === "anthropic") {
        const apiUrl = isDev ? "/api/anthropic" : "https://api.anthropic.com/v1/messages";
        const key = getApiKey("anthropic");
        const headers = { "Content-Type": "application/json", "anthropic-version": "2023-06-01", ...(key ? { "x-api-key": key } : {}) };
        const body = {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          system: systemPrompt,
          messages: messagesForApi,
        };
        const res = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        reply = (data.content || []).map((c) => c?.text || "").join("");
      } else if (chatProvider === "openai") {
        const base = isDev ? "/api/openai" : "https://api.openai.com";
        const key = getApiKey("openai");
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...messagesForApi],
            max_tokens: 4096,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        reply = data?.choices?.[0]?.message?.content ?? "";
      } else if (chatProvider === "ollama") {
        const base = (import.meta.env.VITE_OLLAMA_BASE_URL || "").trim() || (isDev ? "/api/ollama" : "http://localhost:11434");
        const model = (import.meta.env.VITE_OLLAMA_MODEL || "llama3.2").trim();
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...messagesForApi],
            max_tokens: 4096,
            stream: false,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 404 || /not found|unknown model/i.test(errText)) {
            throw new Error(`Ollama model "${model}" not found. Run: ollama pull ${model}`);
          }
          throw new Error(errText || `Ollama ${res.status}`);
        }
        const data = await res.json();
        reply = data?.choices?.[0]?.message?.content ?? "";
      } else if (chatProvider === "groq-compound" || chatProvider === "groq") {
        const base = isDev ? "/api/groq" : "https://api.groq.com";
        const key = getApiKey("groq");
        const isCompound = chatProvider === "groq-compound";
        const body = isCompound
          ? { model: "groq/compound", messages: [{ role: "system", content: systemPrompt }, ...messagesForApi], max_tokens: 4096, compound_custom: { tools: { enabled_tools: ["visit_website", "web_search"] } } }
          : { model: "meta-llama/llama-4-scout-17b-16e-instruct", messages: [{ role: "system", content: systemPrompt }, ...messagesForApi], max_tokens: 4096 };
        const headers = { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(isCompound ? { "Groq-Model-Version": "latest" } : {}) };
        const GROQ_TIMEOUT_MS = 120_000;
        const doReq = (signal) => fetch(`${base}/openai/v1/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal });
        const parseWaitSec = (msg) => { const m = (msg || "").match(/try again in ([\d.]+)s/i); return m ? Math.min(60, Math.max(18, Math.ceil(parseFloat(m[1]) + 2))) : 20; };
        let res;
        const runWithTimeout = async () => {
          const ac = new AbortController();
          const timeoutId = setTimeout(() => ac.abort(), GROQ_TIMEOUT_MS);
          try {
            res = await doReq(ac.signal);
            return res;
          } finally {
            clearTimeout(timeoutId);
          }
        };
        res = await runWithTimeout();
        for (let retries = 0; retries < 2 && !res.ok; retries++) {
          const errText = await res.text();
          let errJson;
          try { errJson = JSON.parse(errText); } catch (_) {}
          const isRateLimit = res.status === 429 || errJson?.error?.code === "rate_limit_exceeded";
          if (!isRateLimit) throw new Error(errText);
          const waitSec = parseWaitSec(errJson?.error?.message);
          const waitMs = waitSec * 1000;
          setChatWaitSeconds(waitSec);
          const interval = setInterval(() => {
            setChatWaitSeconds((s) => (s == null || s <= 1 ? null : s - 1));
          }, 1000);
          await new Promise((r) => setTimeout(r, waitMs));
          clearInterval(interval);
          setChatWaitSeconds(null);
          res = await runWithTimeout();
        }
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        reply = data?.choices?.[0]?.message?.content ?? "";
      } else {
        const base = isDev ? "/api/gemini" : "https://generativelanguage.googleapis.com";
        const key = getApiKey("gemini");
        const url = `${base}/v1beta/models/gemini-2.5-flash:generateContent`;
        const headers = { "Content-Type": "application/json" };
        if (key) headers["x-goog-api-key"] = key;
        const contents = messagesForApi.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 4096, temperature: 0.2 } }) });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        reply = (data.candidates?.[0]?.content?.parts || []).map((p) => p?.text || "").join("");
      }
      if (reply.trim()) {
        setChatConversations((prev) =>
          prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, { role: "assistant", content: reply.trim() }] } : c))
        );
      }
    } catch (e) {
      const raw = e?.message || String(e);
      let msg;
      try {
        const err = typeof raw === "string" && raw.startsWith("{") ? JSON.parse(raw) : null;
        if (err?.error?.code === "request_too_large" || /request entity too large|request_too_large/i.test(raw)) {
          msg = "Request too large. Your message, plus biomarker context, linked page content, and conversation history, exceed this provider’s limit. Try starting a new chat, using fewer @ mentions, or including fewer or smaller linked pages.";
        } else if (e?.name === "AbortError" || /abort/i.test(raw)) {
          msg = "Request timed out (2 min). Groq Compound can be slow when visiting links; try again or use a simpler question.";
        } else {
          msg = "Error: " + raw;
        }
      } catch (_) {
        msg = "Error: " + raw;
      }
      setChatConversations((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, { role: "assistant", content: msg }] } : c))
      );
    } finally {
      setChatLoading(false);
      setChatWaitSeconds(null);
    }
  };

  if (loading) return (
    <div style={{ background: themeColors.appBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", border: `3px solid ${themeColors.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ color: themeColors.accent, fontFamily: "'Courier New', monospace", fontSize: 14, letterSpacing: 2 }}>LOADING</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (googleClientId && !driveToken && !skipDrive) {
    const handleGoogleSignIn = async () => {
      setDriveLoadError(null);
      setDriveSigningIn(true);
      try {
        const token = await requestDriveToken(googleClientId);
        if (!token) {
          setDriveSigningIn(false);
          return;
        }
        setDriveToken(token);
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem("biotracker-drive-token", token);
        const { fileId, data } = await getOrCreateAppData(token);
        setDriveFileId(fileId);
        setPeople(data.people);
        setEntries(data.entries);
        setApiKeysFromDrive(data.settings?.apiKeys || {});
        setWhoopSettings(normalizeWhoopSettings(data.settings?.whoop));
        setWhoopCache(data.whoopCache && typeof data.whoopCache === "object" ? data.whoopCache : {});
        setDriveStatus("connected");
        setDriveLoadError(null);
        if (data.people?.length) setSelectedPerson(data.people[0].id);
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem("biotracker-drive-fileId", fileId);
      } catch (e) {
        setDriveLoadError(e?.message || "Sign-in failed");
      }
      setDriveSigningIn(false);
    };
    return (
      <div data-theme={theme} style={{ background: themeColors.appBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', 'Courier New', monospace", color: themeColors.text }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${themeColors.accent}, ${themeColors.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 20px" }}>🧬</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: themeColors.accent, marginBottom: 8, fontFamily: "Space Grotesk, sans-serif" }}>Biotracker</div>
          <div style={{ fontSize: 13, color: themeColors.textDim, marginBottom: 24 }}>Sign in with Google to store your data and API keys in your Drive. Data stays private in your account.</div>
          {driveLoadError && <div style={{ fontSize: 12, color: "#f66", marginBottom: 12, padding: "8px 12px", background: "rgba(255,100,100,0.1)", borderRadius: 8 }}>{driveLoadError}</div>}
          <button type="button" className="btn btn-primary" onClick={handleGoogleSignIn} disabled={driveSigningIn} style={{ width: "100%", marginBottom: 12, padding: "12px 20px" }}>
            {driveSigningIn ? "Signing in…" : "Sign in with Google"}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setSkipDrive(true)}>
            Continue without Google
          </button>
          <div style={{ fontSize: 11, color: themeColors.textDim, marginTop: 20 }}>Without Google, data is stored on this device only. Import a backup (Tools → Import backup) to load data.</div>
        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} style={{ background: themeColors.appBg, minHeight: "100vh", fontFamily: "'DM Mono', 'Courier New', monospace", color: themeColors.text, display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        [data-theme="dark"] {
          --app-bg: #050a14;
          --card-bg: linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%);
          --card-border: #1a3050;
          --card-hover: #2a4060;
          --input-bg: #0a1628;
          --input-border: #1a3050;
          --input-color: #c8d8f0;
          --input-focus: #0ef;
          --modal-bg: #0a1628;
          --modal-overlay: rgba(5,10,20,0.85);
          --accent: #0ef;
          --accent-dark: #0090a8;
          --tab-inactive: #5a7a9a;
          --scroll-track: #0a1628;
          --scroll-thumb: #1a3050;
        }
        [data-theme="light"] {
          --app-bg: #e8eef4;
          --card-bg: linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%);
          --card-border: #b8c8d8;
          --card-hover: #8aa0b8;
          --input-bg: #ffffff;
          --input-border: #b8c8d8;
          --input-color: #1a2332;
          --input-focus: #007a8a;
          --modal-bg: #ffffff;
          --modal-overlay: rgba(0,0,0,0.4);
          --accent: #007a8a;
          --accent-dark: #005a68;
          --tab-inactive: #6b7c8f;
          --scroll-track: #e0e8f0;
          --scroll-thumb: #b8c8d8;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: var(--scroll-track); }
        ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideIn { from { transform: translateY(-10px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 10px rgba(0,238,255,0.2); } 50% { box-shadow: 0 0 20px rgba(0,238,255,0.4); } }
        .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; transition: border-color 0.2s; }
        .card:hover { border-color: var(--card-hover); }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent-dark)); color: #fff; font-weight: 600; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-secondary { background: var(--input-bg); border: 1px solid var(--card-border); color: var(--tab-inactive); }
        .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
        .btn-danger { background: rgba(255,94,94,0.1); border: 1px solid rgba(255,94,94,0.3); color: #ff5e5e; }
        .stat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        input, select, textarea { background: var(--input-bg); border: 1px solid var(--input-border); color: var(--input-color); font-family: inherit; font-size: 13px; border-radius: 8px; padding: 8px 12px; width: 100%; outline: none; transition: border-color 0.2s; }
        input:focus, select:focus, textarea:focus { border-color: var(--input-focus); }
        select option { background: var(--input-bg); }
        .modal-bg { position: fixed; inset: 0; background: var(--modal-overlay); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: var(--modal-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 28px; width: 100%; animation: slideIn 0.2s ease; overflow-y: auto; max-height: 90vh; }
        .tab-btn { padding: 8px 16px; border-radius: 8px; font-family: inherit; font-size: 12px; cursor: pointer; border: none; transition: all 0.2s; background: transparent; color: var(--tab-inactive); }
        .tab-btn.active { background: var(--input-bg); color: var(--accent); border: 1px solid var(--card-border); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 768px) {
          .grid-2, .grid-3 { grid-template-columns: 1fr; }
          .card { padding: 14px; }
          .modal { padding: 16px; max-height: 85vh; }
          .btn { min-height: 44px; padding: 10px 16px; }
          input, select, textarea { min-height: 44px; }
          .modal-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <input
        type="file"
        ref={importBackupInputRef}
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBackupImportMessage(null);
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            const parsedPeople = Array.isArray(data.people) ? data.people : [];
            const parsedEntries = data.entries && typeof data.entries === "object" ? data.entries : {};
            const keysObj = apiKeysFromBackupData(data);
            const hasAnyKey = Object.values(keysObj).some((v) => v && String(v).trim());
            const importedWhoop = whoopFromBackupData(data);
            const importedWhoopCache = data.whoopCache && typeof data.whoopCache === "object" ? data.whoopCache : {};
            const hasWhoop =
              Object.keys(importedWhoop.tokensByPersonId || {}).length > 0 ||
              !!(importedWhoop.clientId || importedWhoop.clientSecret || importedWhoop.redirectUri) ||
              Object.keys(importedWhoopCache).length > 0;
            await save(parsedPeople, parsedEntries, {
              apiKeysOverride: keysObj,
              whoopSettingsOverride: importedWhoop,
              whoopCacheOverride: importedWhoopCache,
            });
            setSelectedPerson(parsedPeople[0]?.id ?? null);
            setBackupImportMessage(
              `Imported ${parsedPeople.length} person(s), ${Object.keys(parsedEntries).length} profile(s) of entries${hasAnyKey ? ", and API keys" : ""}${hasWhoop ? ", and WHOOP data" : ""}.`
            );
            setTimeout(() => setBackupImportMessage(null), 5000);
          } catch (err) {
            setBackupImportMessage(err?.message || "Invalid backup file");
            setTimeout(() => setBackupImportMessage(null), 5000);
          }
        }}
      />

      {/* TOP NAV */}
      <nav style={{ padding: isMobile ? "10px 12px" : "12px 24px", borderBottom: `1px solid ${themeColors.border}`, display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexWrap: "wrap", background: themeColors.navBg, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 50 }}>
        {isMobile && (
          <button type="button" onClick={() => setSidebarOpen(o => !o)} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${themeColors.border}`, borderRadius: 8, color: themeColors.textMuted, cursor: "pointer", fontSize: 20 }} aria-label="Menu">☰</button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: isMobile ? 4 : 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${themeColors.accent}, ${themeColors.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧬</div>
          <div>
            <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: themeColors.accent, letterSpacing: 1, fontFamily: "Space Grotesk, sans-serif" }}>BIOTRACKER</div>
            <div style={{ fontSize: 9, color: themeColors.textDim, letterSpacing: 2 }}>BIOMARKER TRACKER</div>
          </div>
        </div>

        {/* Current person + dropdown (other persons & Add person) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, position: "relative" }}>
          {people.length === 0 ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={() => setShowAddPersonModal(true)}
            >
              <span style={{ marginRight: 6 }}>👤</span> Add person
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setPersonDropdownOpen(o => !o)}
              style={{ background: `${themeColors.accent}1a`, border: `1px solid ${themeColors.accent}`, borderRadius: 8, color: themeColors.accent, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg, ${themeColors.accentDark}, #003070)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: themeColors.accent }}>{currentPerson?.avatar}</div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{currentPerson?.name}</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
            </button>
          )}
          {personDropdownOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setPersonDropdownOpen(false)} role="presentation" />
              <div style={{ position: "absolute", left: 0, top: "100%", marginTop: 4, minWidth: 220, maxHeight: 320, overflowY: "auto", background: theme === "dark" ? "#0a1628" : "#fff", border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: 6, zIndex: 99, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                {people.filter(p => p.id !== selectedPerson).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "flex-start", padding: "10px 12px", fontSize: 13 }}
                    onClick={() => { setSelectedPerson(p.id); setPersonDropdownOpen(false); }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${themeColors.accentDark}, #003070)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: themeColors.accent, flexShrink: 0 }}>{p.avatar}</div>
                    {p.name}
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${themeColors.border}`, marginTop: 4, paddingTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "flex-start", padding: "10px 12px", fontSize: 13 }}
                    onClick={() => { setShowAddPersonModal(true); setPersonDropdownOpen(false); }}
                  >
                    <span style={{ fontSize: 16 }}>+</span> Add person
                  </button>
                </div>
              </div>
            </>
          )}
          {confirmDeletePerson != null && (() => {
            const p = people.find(x => x.id === confirmDeletePerson);
            if (!p) return null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,94,94,0.5)", background: "rgba(255,94,94,0.08)", marginLeft: 8 }}>
                <span style={{ fontSize: 12, color: "#ff8888" }}>Delete {p.name}?</span>
                <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => deletePerson(p.id)}>Yes</button>
                <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setConfirmDeletePerson(null)}>No</button>
              </div>
            );
          })()}
          {currentPerson && (
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, marginLeft: 8, flexWrap: "wrap", minWidth: 0, maxWidth: isMobile ? "100%" : "none" }}>
              <div style={{ fontSize: 11, color: themeColors.textDim, whiteSpace: "nowrap" }}>
                {getBirthdayDisplay(currentPerson) && <span>Born {getBirthdayDisplay(currentPerson)}</span>}
                {getAge(currentPerson) && <span>{getBirthdayDisplay(currentPerson) ? " · " : ""}Age {getAge(currentPerson)}</span>}
                {currentPerson.gender && <span> · {currentPerson.gender}</span>}
                <span> · {personEntries.length} test{personEntries.length !== 1 ? "s" : ""}</span>
              </div>
              {healthScore !== null && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: healthScore > 70 ? RANGE_COLORS.optimal : healthScore > 40 ? RANGE_COLORS.sufficient : RANGE_COLORS.high, fontFamily: "Space Grotesk, sans-serif" }}>{healthScore}</span>
                  <span style={{ fontSize: 9, color: themeColors.textDim, letterSpacing: 1 }}>SCORE</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
            style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${themeColors.border}`, borderRadius: 8, color: themeColors.textMuted, cursor: "pointer", fontSize: 18 }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>

          <div style={{ position: "relative" }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowSettingsMenu(m => !m)}
              style={{ fontSize: 11 }}
              title="Tools & settings"
            >
              ⚙ Tools
            </button>
            {showSettingsMenu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowSettingsMenu(false)} />
                <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, minWidth: 200, background: theme === "dark" ? "#0a1628" : "#fff", border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: 8, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    disabled={!currentPerson}
                    title={!currentPerson ? "Add a person first" : undefined}
                    onClick={() => { setImportStatus(null); setImportTargetPersonId(selectedPerson); setShowImportModal(true); setShowSettingsMenu(false); }}
                  >
                    📄 Import LAB results
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    disabled={!currentPerson}
                    title={!currentPerson ? "Add a person first" : undefined}
                    onClick={() => { setShowManualEntry(true); setShowSettingsMenu(false); }}
                  >
                    + Manual Entry
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    disabled={!currentPerson}
                    onClick={() => { setShowEditPersonModal(true); setShowSettingsMenu(false); }}
                  >
                    ✏ Edit person
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    disabled={!currentPerson}
                    onClick={() => { setShowExportModal(true); setShowSettingsMenu(false); }}
                  >
                    ⬇ Export PDF
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    onClick={() => {
                      setShowSettingsMenu(false);
                      const entriesWithFiles = Object.fromEntries(
                        Object.entries(entries).map(([pid, list]) => [
                          pid,
                          (list || []).map((e) => ({
                            id: e.id,
                            date: e.date,
                            biomarkers: e.biomarkers,
                            extractedName: e.extractedName,
                            extractedNameEnglish: e.extractedNameEnglish,
                            importedFile: e.importedFile ?? null,
                          })),
                        ])
                      );
                      const payload = {
                        people,
                        entries: entriesWithFiles,
                        settings: { apiKeys: apiKeysFromDrive, whoop: whoopSettings },
                        whoopCache,
                        exportedAt: new Date().toISOString(),
                        version: 1,
                      };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `biotracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    📦 Export backup (JSON)
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    onClick={() => { setShowSettingsMenu(false); importBackupInputRef.current?.click(); }}
                  >
                    📥 Import backup (JSON)
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    onClick={() => {
                      setShowSettingsMenu(false);
                      if (driveStatus === "connected" && driveToken) {
                        if (typeof sessionStorage !== "undefined") {
                          sessionStorage.removeItem("biotracker-drive-token");
                          sessionStorage.removeItem("biotracker-drive-fileId");
                        }
                        setDriveToken(null);
                        setDriveFileId(null);
                        setDriveStatus("disconnected");
                      } else if (!googleClientId) {
                        alert("Google Drive\n\nSet VITE_GOOGLE_CLIENT_ID in .env and create a Google Cloud OAuth client (Drive API, app data scope) to sync data to your Drive.");
                      }
                    }}
                  >
                    ☁️ {driveStatus === "connected" ? "Drive: Disconnect" : "Drive: Connect"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    onClick={() => {
                      openApiKeysModal();
                      setShowSettingsMenu(false);
                    }}
                  >
                    🔑 API keys & WHOOP{driveStatus === "connected" ? " (Drive)" : ""}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", fontSize: 12 }}
                    disabled={!currentPerson}
                    onClick={() => { if (currentPerson) setConfirmDeletePerson(currentPerson.id); setShowSettingsMenu(false); }}
                  >
                    🗑 Delete person
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", fontSize: 12, marginTop: 8 }}
                    onClick={() => {
                      setShowSettingsMenu(false);
                      if (!window.confirm("Clear all people, entries, API keys, and WHOOP data from this device? You can load them again by importing a backup.")) return;
                      if (typeof localStorage !== "undefined") {
                        localStorage.removeItem("bloodwork-people");
                        localStorage.removeItem("bloodwork-entries");
                        localStorage.removeItem("bloodwork-whoop");
                        localStorage.removeItem("biotracker-api-keys");
                      }
                      setPeople(INIT_PEOPLE);
                      setEntries({});
                      setApiKeysFromDrive({});
                      setWhoopSettings(normalizeWhoopSettings(null));
                      setWhoopCache({});
                      setSelectedPerson(null);
                      setSaveError(null);
                    }}
                  >
                    🧹 Clear all data (this device)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1, position: "relative", flexDirection: "column", minHeight: 0 }}>
        {saveError && (
          <div style={{ flexShrink: 0, padding: "10px 16px", background: "rgba(255,94,94,0.15)", borderBottom: "1px solid rgba(255,94,94,0.4)", color: "#ff8888", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>⚠ {saveError}</span>
            <button type="button" onClick={() => setSaveError(null)} style={{ background: "none", border: "none", color: "#ffaaaa", cursor: "pointer", fontSize: 18, lineHeight: 1 }} aria-label="Dismiss">×</button>
          </div>
        )}
        {backupImportMessage && (
          <div style={{ flexShrink: 0, padding: "10px 16px", background: backupImportMessage.startsWith("Imported") ? "rgba(0,200,120,0.15)" : "rgba(255,94,94,0.15)", borderBottom: backupImportMessage.startsWith("Imported") ? "1px solid rgba(0,200,120,0.4)" : "1px solid rgba(255,94,94,0.4)", color: backupImportMessage.startsWith("Imported") ? "#6acc9a" : "#ff8888", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>{backupImportMessage.startsWith("Imported") ? "✓ " : "⚠ "}{backupImportMessage}</span>
            <button type="button" onClick={() => setBackupImportMessage(null)} style={{ background: "none", border: "none", color: "inherit", opacity: 0.8, cursor: "pointer", fontSize: 18, lineHeight: 1 }} aria-label="Dismiss">×</button>
          </div>
        )}
        <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
        {isMobile && sidebarOpen && (
          <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 55 }} onClick={() => setSidebarOpen(false)} />
        )}
        {/* SIDEBAR */}
        <aside style={{
          width: 200,
          borderRight: `1px solid ${themeColors.border}`,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
          ...(isMobile ? {
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 60,
            background: themeColors.appBg,
            transition: "transform 0.2s ease",
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          } : {}),
        }}>
          <button type="button" onClick={() => { setSelectedBiomarker(null); setViewBeforeTrendDetail(null); setView("biomarkers"); if (isMobile) setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", minHeight: 44, borderRadius: 8, border: "none", cursor: "pointer", background: navBiomarkersActive ? `${themeColors.accent}14` : "transparent", color: navBiomarkersActive ? themeColors.accent : themeColors.textMuted, transition: "all 0.2s", textAlign: "left", fontSize: 13, fontFamily: "inherit" }}>
            <span style={{ fontSize: 16 }}>⬡</span>
            Biomarkers
          </button>
          <button type="button" onClick={() => { setSelectedBiomarker(null); setSelectedFitnessMarker(null); setViewBeforeTrendDetail(null); setView("fitness"); if (isMobile) setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", minHeight: 44, borderRadius: 8, border: "none", cursor: "pointer", background: view === "fitness" ? `${themeColors.accent}14` : "transparent", color: view === "fitness" ? themeColors.accent : themeColors.textMuted, transition: "all 0.2s", textAlign: "left", fontSize: 13, fontFamily: "inherit" }}>
            <span style={{ fontSize: 16 }}>◎</span>
            Fitness
          </button>
          <button type="button" onClick={() => { setSelectedBiomarker(null); setViewBeforeTrendDetail(null); setView("history"); if (isMobile) setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", minHeight: 44, borderRadius: 8, border: "none", cursor: "pointer", background: navHistoryActive ? `${themeColors.accent}14` : "transparent", color: navHistoryActive ? themeColors.accent : themeColors.textMuted, transition: "all 0.2s", textAlign: "left", fontSize: 13, fontFamily: "inherit" }}>
            <span style={{ fontSize: 16 }}>◧</span>
            History
          </button>
          <div style={{ borderTop: `1px solid ${themeColors.border}`, marginTop: 8, paddingTop: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => { setFilterCat(cat); setSelectedBiomarker(null); setViewBeforeTrendDetail(null); setView("biomarkers"); if (isMobile) setSidebarOpen(false); }} style={{ display: "block", width: "100%", padding: "10px 12px", minHeight: 40, borderRadius: 6, border: "none", cursor: "pointer", background: filterCat === cat && categorySidebarActive ? `${themeColors.accent}0d` : "transparent", color: filterCat === cat && categorySidebarActive ? themeColors.textMuted : themeColors.textDim, transition: "all 0.2s", textAlign: "left", fontSize: 11, fontFamily: "inherit" }}>
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, padding: isMobile ? 12 : 24, overflow: "auto", minWidth: 0 }}>
          {/* No person: prompt to add first */}
          {!currentPerson && (
            <div className="card" style={{ textAlign: "center", padding: 80, maxWidth: 480, margin: "40px auto" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
              <div style={{ fontSize: 18, color: "#8aabcc", marginBottom: 8, fontFamily: "Space Grotesk, sans-serif" }}>No person yet</div>
              <div style={{ fontSize: 13, color: "#3a5a7a", marginBottom: 24 }}>Add your first person to start tracking biomarkers and importing bloodwork.</div>
              <button className="btn btn-primary" onClick={() => setShowAddPersonModal(true)}>+ Add Person</button>
            </div>
          )}

          {/* ── VIEWS (only when a person is selected) ── */}
          {/* ── BIOMARKERS VIEW ── */}
          {currentPerson && view === "biomarkers" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {Object.keys(cumulativeSnapshot).length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: 40, marginBottom: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🧬</div>
                  <div style={{ fontSize: 16, color: "#8aabcc", marginBottom: 6, fontFamily: "Space Grotesk, sans-serif" }}>No bloodwork data yet</div>
                  <div style={{ fontSize: 12, color: "#3a5a7a", marginBottom: 16 }}>Import a PDF or add manual entries — you can still browse all markers below.</div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={() => { setImportTargetPersonId(selectedPerson); setShowImportModal(true); }}>📄 Import LAB results</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowManualEntry(true)}>+ Manual Entry</button>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: isMobile ? 8 : 12, marginBottom: 20 }}>
                {[
                  { label: "Optimal", key: "optimal", count: counts.optimal, color: RANGE_COLORS.optimal },
                  { label: "Sufficient", key: "sufficient", count: counts.sufficient, color: RANGE_COLORS.sufficient },
                  { label: "Elite", key: "elite", count: counts.elite, color: RANGE_COLORS.elite },
                  { label: "High", key: "high", count: counts.high, color: RANGE_COLORS.high },
                  { label: "Low", key: "low", count: counts.low, color: RANGE_COLORS.low },
                ].map(item => (
                  <div
                    key={item.label}
                    role="button"
                    tabIndex={0}
                    className="card"
                    onClick={() => setStatusFilter(statusFilter === item.key ? null : item.key)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStatusFilter(statusFilter === item.key ? null : item.key); } }}
                    style={{ textAlign: "center", border: `1px solid ${statusFilter === item.key ? item.color : item.color + "22"}`, cursor: "pointer", background: statusFilter === item.key ? `${item.color}18` : undefined, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <div style={{ fontSize: 26, fontWeight: 700, color: item.color, fontFamily: "Space Grotesk, sans-serif" }}>{item.count}</div>
                    <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1 }}>{item.label.toUpperCase()}</div>
                    {statusFilter === item.key && <div style={{ fontSize: 9, color: item.color, marginTop: 4, letterSpacing: 1 }}>CLICK TO CLEAR</div>}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <input placeholder="Search biomarkers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 260 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["All", ...CATEGORIES].map(cat => (
                    <button key={cat} className={`tab-btn ${filterCat === cat ? "active" : ""}`} onClick={() => setFilterCat(cat)} style={{ fontSize: 11 }}>{cat}</button>
                  ))}
                  <button
                    className={`tab-btn ${filterRecord === "noRecord" ? "active" : ""}`}
                    onClick={() => setFilterRecord(filterRecord === "noRecord" ? "all" : "noRecord")}
                    style={{ fontSize: 11 }}
                  >
                    No record
                  </button>
                </div>
                <div style={{ marginLeft: isMobile ? 0 : "auto", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: themeColors.textDim }}>{totalBiomarkersCount} biomarkers · {noRecordCount} with no record</span>
                  <div style={{ display: "flex", gap: 0, border: `1px solid ${themeColors.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <button
                      type="button"
                      onClick={() => setBiomarkersViewMode("cards")}
                      style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "cards" ? themeColors.accent : "transparent", color: biomarkersViewMode === "cards" ? "#fff" : themeColors.textMuted }}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setBiomarkersViewMode("table")}
                      style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "table" ? themeColors.accent : "transparent", color: biomarkersViewMode === "table" ? "#fff" : themeColors.textMuted }}
                    >
                      Table
                    </button>
                  </div>
                </div>
              </div>

              {biomarkersViewMode === "cards" && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {filteredBiomarkers.map(name => {
                  const b = BIOMARKER_DB[name];
                  const snap = cumulativeSnapshot[name];
                  const snapVal = snap?.val;
                  const snapDate = snap?.date;
                  const status = snapVal !== undefined ? getStatus(name, snapVal) : "unknown";
                  const isOld = latestEntry && snapDate && snapDate !== latestEntry.date;
                  return (
                    <div key={name} className="card" style={{ cursor: "pointer", borderLeft: `3px solid ${statusColor(status)}` }}
                      onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#c8d8f0", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
                          <div style={{ fontSize: 10, color: "#3a5a7a", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.category} · {b.unit} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
                          {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 9, color: "#4a6a8a", marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); setShowInfoModal(name); }} style={{ background: "none", border: "none", color: "#3a5a7a", cursor: "pointer", fontSize: 16, padding: 4 }}>ⓘ</button>
                      </div>
                      {snapVal !== undefined ? (
                        <>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                            <span style={{ fontSize: 26, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{parseLabValue(snapVal).display}</span>
                            <span style={{ fontSize: 11, color: "#4a6a8a" }}>{b.unit}</span>
                            <div className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9, marginLeft: "auto" }}>{status.toUpperCase()}</div>
                          </div>
                          {isOld && (
                            <div style={{ fontSize: 9, color: "#3a5a7a", marginTop: 4 }}>
                              as of {new Date(snapDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          style={{ marginTop: 12, fontSize: 12, color: "#3a5a7a" }}
                          title={DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, cumulativeSnapshot); return m.length ? `Not calculated: missing ${m.join(", ")}` : "No data recorded"; })() : "No data recorded"}
                        >
                          No data recorded
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 10 }}>
                        <span style={{ color: RANGE_COLORS.optimal + "44", borderBottom: `1px solid ${RANGE_COLORS.optimal}44`, padding: "1px 0" }}>Optimal: {b.optimal[0]}–{b.optimal[1] > 999 ? "∞" : b.optimal[1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {biomarkersViewMode === "table" && (() => {
                const STATUS_SORT_ORDER = { optimal: 0, elite: 1, sufficient: 2, low: 3, high: 4, "out-of-range": 5, unknown: 6 };
                const trendRank = (name) => {
                  const trend = getTrend(name);
                  if (!trend) return 3;
                  const hib = higherIsBetter(name);
                  const improving = (trend === "up" && hib) || (trend === "down" && !hib);
                  const worsening = (trend === "up" && !hib) || (trend === "down" && hib);
                  if (improving) return 0;
                  if (trend === "stable") return 1;
                  if (worsening) return 2;
                  return 3;
                };
                const hasData = (name) => cumulativeSnapshot[name]?.val !== undefined;
                const sortedForTable = [...filteredBiomarkers].sort((a, b) => {
                  const dir = biomarkersTableSort.dir === "asc" ? 1 : -1;
                  const dataA = hasData(a);
                  const dataB = hasData(b);
                  if (!dataA && dataB) return 1;
                  if (dataA && !dataB) return -1;
                  if (!dataA && !dataB) return dir * a.localeCompare(b, undefined, { sensitivity: "base" });
                  if (biomarkersTableSort.by === "name") {
                    return dir * a.localeCompare(b, undefined, { sensitivity: "base" });
                  }
                  if (biomarkersTableSort.by === "status") {
                    const statusA = getStatus(a, cumulativeSnapshot[a].val);
                    const statusB = getStatus(b, cumulativeSnapshot[b].val);
                    const rankA = STATUS_SORT_ORDER[statusA] ?? 6;
                    const rankB = STATUS_SORT_ORDER[statusB] ?? 6;
                    return dir * (rankA - rankB || a.localeCompare(b));
                  }
                  if (biomarkersTableSort.by === "category") {
                    const catA = BIOMARKER_DB[a]?.category ?? "";
                    const catB = BIOMARKER_DB[b]?.category ?? "";
                    return dir * (catA.localeCompare(catB) || a.localeCompare(b));
                  }
                  if (biomarkersTableSort.by === "trend") {
                    const rA = trendRank(a);
                    const rB = trendRank(b);
                    return dir * (rA - rB || a.localeCompare(b));
                  }
                  if (biomarkersTableSort.by === "value") {
                    const numA = parseLabValue(cumulativeSnapshot[a].val).numeric;
                    const numB = parseLabValue(cumulativeSnapshot[b].val).numeric;
                    return dir * ((Number.isFinite(numA) ? numA : -Infinity) - (Number.isFinite(numB) ? numB : -Infinity)) || dir * a.localeCompare(b);
                  }
                  if (biomarkersTableSort.by === "range") {
                    const statusA = getStatus(a, cumulativeSnapshot[a].val);
                    const statusB = getStatus(b, cumulativeSnapshot[b].val);
                    const rankA = STATUS_SORT_ORDER[statusA] ?? 6;
                    const rankB = STATUS_SORT_ORDER[statusB] ?? 6;
                    return dir * (rankA - rankB || a.localeCompare(b));
                  }
                  return 0;
                });
                const toggleSort = (by) => {
                  setBiomarkersTableSort(prev => ({ by, dir: prev.by === by && prev.dir === "asc" ? "desc" : "asc" }));
                };
                const thSortable = (label, sortKey, align = "left", extraStyle = {}) => (
                  <th
                    style={{ textAlign: align, padding: "10px 12px", color: themeColors.textDim, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", ...extraStyle }}
                    onClick={() => toggleSort(sortKey)}
                    title={`Sort by ${label}`}
                  >
                    {label} {biomarkersTableSort.by === sortKey ? (biomarkersTableSort.dir === "asc" ? "↑" : "↓") : ""}
                  </th>
                );
                return (
                  <div className="card" style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                          {thSortable("Biomarker", "name")}
                          {thSortable("Value", "value", "right")}
                          {thSortable("Range", "range", "left", { minWidth: isMobile ? 120 : 200 })}
                          {thSortable("Status", "status")}
                          {thSortable("Trend", "trend", "center")}
                          {thSortable("Category", "category")}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedForTable.map(name => {
                          const b = BIOMARKER_DB[name];
                          const snap = cumulativeSnapshot[name];
                          const val = snap?.val;
                          const status = val !== undefined ? getStatus(name, val) : "unknown";
                          const trend = getTrend(name);
                          const valueGoingUp = trend === "up";
                          const valueGoingDown = trend === "down";
                          const hib = higherIsBetter(name);
                          const improving = (valueGoingUp && hib) || (valueGoingDown && !hib);
                          const worsening = (valueGoingUp && !hib) || (valueGoingDown && hib);
                          const trendColor = improving ? RANGE_COLORS.optimal : worsening ? RANGE_COLORS.high : themeColors.textDim;
                          const { display: displayVal, numeric: numVal } = val !== undefined ? parseLabValue(val) : { display: "—", numeric: NaN };
                          const bar = buildRangeBar(b, numVal);
                          const trendTitle = trend ? (improving ? "Improving" : worsening ? "Worsening" : "Stable") : "Need 2+ readings";
                          return (
                            <tr
                              key={name}
                              onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }}
                              style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}
                            >
                              <td style={{ padding: "10px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.icon} {name} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}
                                <button type="button" onClick={e => { e.stopPropagation(); setShowInfoModal(name); }} style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", fontSize: 12, padding: "0 2px" }} title="Info">ⓘ</button></div>
                                {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 10, color: themeColors.textDim, marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                              </td>
                              <td
                                style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: val !== undefined ? statusColor(status) : themeColors.textDim, whiteSpace: "nowrap" }}
                                title={val === undefined && DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, cumulativeSnapshot); return m.length ? `Not calculated: missing ${m.join(", ")}` : undefined; })() : undefined}
                              >
                                {displayVal} {b.unit}
                              </td>
                              <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                                <RangeBarSegments segments={bar.segments} valuePos={bar.valuePos} height={24} />
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 10 }}>{status.replace(/-/g, " ")}</span>
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, color: trendColor }} title={trendTitle}>
                                {valueGoingUp ? "↗" : valueGoingDown ? "↘" : trend === "stable" ? "→" : "—"}
                              </td>
                              <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{b.category}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Trend detail (opened from Biomarkers or History; no standalone Trends browse view) */}
          {currentPerson && view === "trends" && selectedBiomarker && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              <TrendDetail
                name={selectedBiomarker}
                personEntries={personEntries}
                onBack={() => {
                  setView(viewBeforeTrendDetail ?? "biomarkers");
                  setSelectedBiomarker(null);
                  setViewBeforeTrendDetail(null);
                }}
                themeColors={themeColors}
              />
            </div>
          )}

          {/* ── FITNESS (WHOOP) VIEW ── */}
          {currentPerson && view === "fitness" && selectedFitnessMarker && (
            <WhoopTrendDetail
              markerId={selectedFitnessMarker}
              cache={whoopCache[selectedPerson] || null}
              onBack={() => setSelectedFitnessMarker(null)}
              themeColors={themeColors}
            />
          )}
          {currentPerson && view === "fitness" && !selectedFitnessMarker && (
            <FitnessWhoopView
              themeColors={themeColors}
              cache={whoopCache[selectedPerson] || null}
              connected={Boolean(
                whoopSettings.tokensByPersonId?.[selectedPerson]?.refreshToken ||
                  whoopSettings.tokensByPersonId?.[selectedPerson]?.accessToken
              )}
              syncState={whoopSyncState}
              onSync={() => void runWhoopSync()}
              onConnect={() => void beginWhoopOAuth()}
              onDisconnect={disconnectWhoop}
              effectiveRedirectUri={whoopEffectiveRedirectUri}
              onOpenConnectionSettings={openApiKeysModal}
              isMobile={isMobile}
              onMarkerClick={(id) => setSelectedFitnessMarker(id)}
            />
          )}

          {/* ── HISTORY VIEW ── */}
          {currentPerson && view === "history" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {personEntries.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 13, color: "#3a5a7a" }}>No test history recorded yet.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 0, border: `1px solid ${themeColors.border}`, borderRadius: 8, overflow: "hidden" }}>
                      <button type="button" onClick={() => setBiomarkersViewMode("cards")} style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "cards" ? themeColors.accent : "transparent", color: biomarkersViewMode === "cards" ? "#fff" : themeColors.textMuted }}>Cards</button>
                      <button type="button" onClick={() => setBiomarkersViewMode("table")} style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "table" ? themeColors.accent : "transparent", color: biomarkersViewMode === "table" ? "#fff" : themeColors.textMuted }}>Table</button>
                    </div>
                  </div>
                  {[...personEntries].reverse().map(entry => {
                    const entryBiomarkers = computeDerivedBiomarkers(entry.biomarkers || {});
                    const markerCount = Object.keys(entryBiomarkers).length;
                    const optCount = Object.entries(entryBiomarkers).filter(([k, v]) => getStatus(k, v) === "optimal").length;
                    const isPendingDelete = confirmDeleteId === entry.id;
                    const profileName = currentPerson?.name || "";
                    const extractedName = entry.extractedName;
                    const extractedNameEnglish = entry.extractedNameEnglish;
                    const nameMismatch = extractedName && !nameAndSurnameMatch(profileName, extractedNameEnglish, extractedName);
                    return (
                      <div key={entry.id} className="card" style={{ marginBottom: 12, border: isPendingDelete ? "1px solid rgba(255,94,94,0.5)" : nameMismatch ? "1px solid rgba(255,180,80,0.7)" : undefined }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isPendingDelete ? 10 : 14 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#c8d8f0", fontFamily: "Space Grotesk, sans-serif" }}>
                              {new Date(entry.date + "T12:00:00").toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                            </div>
                            {extractedName != null && extractedName !== "" && (
                              <div style={{ fontSize: 12, color: nameMismatch ? "#e8a84a" : "#5a8ab0", marginTop: 4 }}>
                                {nameMismatch ? "⚠ " : ""}Patient on document: {extractedName}
                                {nameMismatch && <span style={{ marginLeft: 6, fontSize: 11, color: "#e8a84a" }}>(differs from profile)</span>}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: "#3a5a7a", marginTop: extractedName ? 2 : 0 }}>{markerCount} markers tracked · {optCount} optimal · <span style={{ color: "#3a6a9a" }}>click any marker to view trend</span></div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: RANGE_COLORS.optimal, fontFamily: "Space Grotesk, sans-serif" }}>
                              {markerCount > 0 ? Math.round(optCount / markerCount * 100) : 0}%
                            </div>
                            {!isPendingDelete ? (
                              <>
                                {entry.importedFile && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: "6px 12px", fontSize: 11 }}
                                    onClick={() => setViewOriginalFile(entry.importedFile)}
                                    title="View original imported file"
                                  >📄 Original</button>
                                )}
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: "6px 12px", fontSize: 11 }}
                                  onClick={() => setConfirmDeleteId(entry.id)}
                                >🗑 Delete</button>
                              </>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "#ff8888" }}>Delete this entry?</span>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
                                  onClick={() => { deleteEntry(selectedPerson, entry.id); setConfirmDeleteId(null); }}
                                >Yes, delete</button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: "6px 12px", fontSize: 12 }}
                                  onClick={() => setConfirmDeleteId(null)}
                                >Cancel</button>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isPendingDelete && (
                          biomarkersViewMode === "cards" ? (
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                            {Object.entries(entryBiomarkers).filter(([name]) => allBiomarkers.includes(name)).map(([name, val]) => {
                              if (!BIOMARKER_DB[name]) return null;
                              const status = getStatus(name, val);
                              return (
                                <div
                                  key={name}
                                  onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }}
                                  style={{ padding: "8px 12px", borderRadius: 8, background: statusBg(status), border: `1px solid ${statusColor(status)}22`, cursor: "pointer", transition: "transform 0.15s" }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.borderColor = statusColor(status) + "66"; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = statusColor(status) + "22"; }}
                                  title={`Click to view ${name} trend`}
                                >
                                  <div style={{ fontSize: 10, color: "#5a7a9a" }}>{name}</div>
                                  {BIOMARKER_DB[name]?.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 8, color: "#4a6a8a" }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                                  <div style={{ fontSize: 16, fontWeight: 600, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{parseLabValue(val).display}</div>
                                  <div style={{ fontSize: 9, color: "#3a5a7a" }}>{BIOMARKER_DB[name]?.unit}</div>
                                </div>
                              );
                            })}
                          </div>
                          ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead><tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                                {(["Biomarker", "Value", "Range", "Category"]).map(col => {
                                  const key = col.toLowerCase().replace(/\s+/g, ""); const k = key === "biomarker" ? "name" : key === "value" ? "value" : key === "range" ? "range" : "category";
                                  return (
                                    <th key={col} style={{ textAlign: k === "value" ? "right" : "left", padding: "10px 12px", color: themeColors.textDim, fontWeight: 600, minWidth: k === "range" ? (isMobile ? 100 : 180) : undefined, cursor: "pointer", userSelect: "none" }} onClick={() => setHistoryTableSort(prev => ({ by: k, dir: prev.by === k && prev.dir === "asc" ? "desc" : "asc" }))} title={`Sort by ${col}`}>
                                      {col} {historyTableSort.by === k ? (historyTableSort.dir === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                  );
                                })}
                              </tr></thead>
                              <tbody>
                                {(() => {
                                  const STATUS_ORD = { optimal: 0, elite: 1, sufficient: 2, low: 3, high: 4, "out-of-range": 5, unknown: 6 };
                                  const filtered = Object.entries(entryBiomarkers).filter(([name]) => allBiomarkers.includes(name));
                                  const dir = historyTableSort.dir === "asc" ? 1 : -1;
                                  const sorted = [...filtered].sort(([aName, aVal], [bName, bVal]) => {
                                    if (historyTableSort.by === "name") return dir * aName.localeCompare(bName, undefined, { sensitivity: "base" });
                                    if (historyTableSort.by === "value") return dir * ((parseLabValue(aVal).numeric ?? 0) - (parseLabValue(bVal).numeric ?? 0)) || dir * aName.localeCompare(bName);
                                    if (historyTableSort.by === "range") return dir * ((STATUS_ORD[getStatus(aName, aVal)] ?? 6) - (STATUS_ORD[getStatus(bName, bVal)] ?? 6)) || dir * aName.localeCompare(bName);
                                    if (historyTableSort.by === "category") return dir * ((BIOMARKER_DB[aName]?.category ?? "").localeCompare(BIOMARKER_DB[bName]?.category ?? "")) || dir * aName.localeCompare(bName);
                                    return 0;
                                  });
                                  return sorted.map(([name, val]) => {
                                    const b = BIOMARKER_DB[name];
                                    if (!b) return null;
                                    const status = getStatus(name, val);
                                    const { display: displayVal, numeric: numVal } = parseLabValue(val);
                                    const bar = buildRangeBar(b, numVal);
                                    return (
                                      <tr key={name} onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }} style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}>
                                        <td style={{ padding: "10px 12px" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.icon} {name} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
                                          {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 10, color: themeColors.textDim, marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                                        </td>
                                        <td
                                          style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: statusColor(status) }}
                                          title={val === undefined && DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, entry.biomarkers || {}); return m.length ? `Not calculated: missing ${m.join(", ")}` : undefined; })() : undefined}
                                        >{displayVal} {b.unit}</td>
                                        <td style={{ padding: "8px 12px" }}><RangeBarSegments segments={bar.segments} valuePos={bar.valuePos} height={24} /></td>
                                        <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{b.category}</td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </main>
        </div>
      </div>

      {/* ── CHAT ── */}
      {!showChatPanel && (
        <button
          type="button"
          onClick={() => setShowChatPanel(true)}
          style={{
            position: "fixed",
            bottom: isMobile ? 20 : 24,
            right: isMobile ? 16 : 24,
            width: isMobile ? 56 : 52,
            height: isMobile ? 56 : 52,
            borderRadius: isMobile ? 28 : 26,
            border: `2px solid ${themeColors.accent}`,
            background: themeColors.appBg,
            color: themeColors.accent,
            fontSize: isMobile ? 26 : 22,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="AI Chat"
          aria-label="Open AI Chat"
        >
          💬
        </button>
      )}
      {showChatPanel && (() => {
        const activeMessages = chatConversations.find((c) => c.id === activeChatId)?.messages ?? [];
        const startNewChat = () => {
          const newId = Date.now();
          setChatConversations((prev) => [...prev, { id: newId, messages: [] }]);
          setActiveChatId(newId);
        };
        const closeChatTab = (id) => {
          setChatConversations((prev) => {
            const next = prev.filter((c) => c.id !== id);
            if (next.length === 0) {
              const newId = Date.now();
              setActiveChatId(newId);
              return [{ id: newId, messages: [] }];
            }
            if (activeChatId === id) setActiveChatId(next[0].id);
            return next;
          });
        };
        const speakReply = (content, msgId) => {
          if (chatPlayingId !== null) {
            window.speechSynthesis?.cancel();
            if (chatPlayingId === msgId) {
              setChatPlayingId(null);
              return;
            }
          }
          const u = new SpeechSynthesisUtterance(content);
          const voices = window.speechSynthesis?.getVoices?.() ?? [];
          const preferred = ["Google", "Microsoft", "Samantha", "Karen", "Daniel", "Natural", "Premium", "Zira", "David"];
          const enVoice = voices.find((v) => (v.lang?.startsWith("en") || v.lang === "en-US") && preferred.some((p) => (v.name || "").includes(p)))
            || voices.find((v) => v.lang === "en-US" || v.lang?.startsWith("en-"))
            || voices[0];
          if (enVoice) u.voice = enVoice;
          u.rate = 0.98;
          u.pitch = 1;
          u.onend = () => setChatPlayingId(null);
          window.speechSynthesis?.speak(u);
          setChatPlayingId(msgId);
        };
        const handleTitleMouseDown = (e) => {
          if (e.button === 0) chatDragStart.current = { startX: e.clientX, startY: e.clientY };
        };
        const handleResizeMouseDown = (e) => {
          if (e.button === 0) chatResizeStart.current = { startW: chatWindowRect.w, startH: chatWindowRect.h, startX: e.clientX, startY: e.clientY };
        };
        const { x, y, w, h } = chatWindowRect;
        const isMin = chatMinimized;
        const CHAT_FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        return (
        <div
          style={{
            position: "fixed",
            left: x,
            top: y,
            width: w,
            height: isMin ? 44 : h,
            minWidth: isMin ? 280 : 480,
            minHeight: isMin ? 44 : 280,
            maxWidth: window.innerWidth - 20,
            maxHeight: window.innerHeight - 40,
            background: theme === "dark" ? "#0a1628" : "#fff",
            border: `1px solid ${themeColors.border}`,
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            onMouseDown={handleTitleMouseDown}
            onClick={() => { if (isMin) setChatMinimized(false); }}
            style={{
              padding: "10px 12px",
              borderBottom: isMin ? "none" : `1px solid ${themeColors.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              cursor: isMin ? "pointer" : "move",
              userSelect: "none",
              background: theme === "dark" ? "#0d1f3c" : "#f5f7fa",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: themeColors.text, fontFamily: CHAT_FONT }}>AI Chat</span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4, overflowX: "auto" }}>
              {chatConversations.map((c, idx) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, background: c.id === activeChatId ? `${themeColors.accent}22` : "transparent", border: `1px solid ${c.id === activeChatId ? themeColors.accent : themeColors.border}`, borderRadius: 6, padding: "2px 6px" }}>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); setActiveChatId(c.id); }} style={{ padding: "2px 6px", fontSize: 11, border: "none", background: "transparent", color: themeColors.text, cursor: "pointer", whiteSpace: "nowrap", fontFamily: CHAT_FONT }}>Chat {idx + 1}</button>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); closeChatTab(c.id); }} style={{ padding: "0 2px", fontSize: 12, border: "none", background: "transparent", color: themeColors.textDim, cursor: "pointer", lineHeight: 1, fontFamily: CHAT_FONT }} aria-label="Close conversation">×</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={(ev) => { ev.stopPropagation(); startNewChat(); }} style={{ padding: "4px 8px", fontSize: 11, border: `1px solid ${themeColors.border}`, background: "transparent", color: themeColors.textDim, cursor: "pointer", borderRadius: 6, fontFamily: CHAT_FONT }} title="New conversation">New</button>
            <button type="button" onClick={(ev) => { ev.stopPropagation(); setChatMinimized((m) => !m); }} style={{ padding: "4px 8px", fontSize: 12, border: "none", background: "transparent", color: themeColors.textDim, cursor: "pointer", fontFamily: CHAT_FONT }} title={isMin ? "Expand" : "Minimize"}>{isMin ? "▢" : "−"}</button>
            <button type="button" onClick={(ev) => { ev.stopPropagation(); setShowChatPanel(false); }} style={{ padding: "4px 8px", fontSize: 12, border: "none", background: "transparent", color: themeColors.textDim, cursor: "pointer", fontFamily: CHAT_FONT }} title="Close">✕</button>
          </div>
          {!isMin && (
            <>
              {!currentPerson && (
                <div style={{ padding: 10, fontSize: 12, color: themeColors.textDim, fontFamily: CHAT_FONT }}>Select a person to use @all, @all_wtrends, @norecord, @Liver, @Lipids_wtrends, @biomarker, @biomarker_wtrend.</div>
              )}
              <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 0, minWidth: 0 }}>
                {activeMessages.length === 0 && (
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: themeColors.textDim, fontFamily: CHAT_FONT, wordBreak: "break-word", overflowWrap: "break-word" }}>Ask anything. Use @all or @all_wtrends for all biomarkers; @norecord for markers with no data; @Liver, @Lipids_wtrends for panel groups; @biomarker or @biomarker_wtrend for one marker.</div>
                )}
                {activeMessages.map((msg, i) => (
                  <div key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%", padding: "12px 16px", borderRadius: 12, background: msg.role === "user" ? `${themeColors.accent}22` : `${themeColors.border}33`, border: `1px solid ${msg.role === "user" ? themeColors.accent : themeColors.border}`, fontSize: 15, lineHeight: 1.6, wordBreak: "break-word", fontFamily: CHAT_FONT }}>
                    {msg.role === "user" ? (
                      <span style={{ whiteSpace: "pre-wrap" }}>{msg.displayContent ?? msg.content}</span>
                    ) : (
                      <>
                        <div style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: formatChatReply(msg.content) }} />
                        <button type="button" onClick={() => speakReply(msg.content, `ai-${i}`)} style={{ marginTop: 8, padding: "6px 10px", fontSize: 12, border: `1px solid ${themeColors.border}`, background: "transparent", color: themeColors.textDim, cursor: "pointer", borderRadius: 6, fontFamily: CHAT_FONT }} title="Play">{chatPlayingId === `ai-${i}` ? "⏹ Stop" : "▶ Play"}</button>
                      </>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf: "flex-start", padding: "8px 12px", fontSize: 14, color: themeColors.textDim, fontFamily: CHAT_FONT }}>
                    {chatWaitSeconds != null
                      ? `Rate limited. Retrying in ${chatWaitSeconds}s…`
                      : chatProvider === "groq-compound"
                        ? "Groq Compound: can take 1–2 min when visiting links…"
                        : "…"}
                  </div>
                )}
              </div>
              <div style={{ padding: 10, borderTop: `1px solid ${themeColors.border}`, flexShrink: 0, position: "relative" }}>
                {chatAttachedFiles.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {chatAttachedFiles.map((f, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", background: `${themeColors.border}33`, borderRadius: 6, fontSize: 11, fontFamily: CHAT_FONT }}>
                        {f.name}
                        <button type="button" onClick={() => setChatAttachedFiles((prev) => prev.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: 12, color: themeColors.textDim, fontFamily: CHAT_FONT }} aria-label="Remove file">×</button>
                      </span>
                    ))}
                  </div>
                )}
                {chatAtOpen && chatAtFiltered.length > 0 && (
                  <div
                    ref={chatAtListRef}
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: 10,
                      right: 10,
                      marginBottom: 4,
                      maxHeight: 200,
                      overflowY: "auto",
                      background: theme === "dark" ? "#0d1f3c" : "#f0f4f8",
                      border: `1px solid ${themeColors.border}`,
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 70,
                    }}
                  >
                    {chatAtFiltered.map((s, i) => (
                      <button
                        key={s}
                        type="button"
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "6px 10px",
                          textAlign: "left",
                          fontSize: 11,
                          border: "none",
                          background: i === chatAtIndex ? `${themeColors.accent}33` : "transparent",
                          color: themeColors.text,
                          cursor: "pointer",
                          fontFamily: CHAT_FONT,
                        }}
                        onMouseDown={(e) => { e.preventDefault(); applyChatAtSuggestion(s); }}
                        onMouseEnter={() => setChatAtIndex(i)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: "8px 10px", background: theme === "dark" ? "#0d1f3c" : "#f8fafc", fontFamily: CHAT_FONT }}>
                  <input
                    type="file"
                    id="chat-file-attach"
                    multiple
                    accept="*/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setChatAttachedFiles((prev) => [...prev, ...files]);
                      e.target.value = "";
                    }}
                  />
                  <label htmlFor="chat-file-attach" style={{ flexShrink: 0, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: themeColors.textDim, border: "none", background: "transparent", borderRadius: 8, fontFamily: CHAT_FONT }} title="Attach files">
                    <span style={{ fontSize: 18 }}>+</span>
                  </label>
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => {
                      handleChatInputChange(e);
                      const el = e.target;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 240) + "px";
                    }}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Ask AI… (type @ for autocomplete)"
                    rows={1}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      minWidth: 200,
                      maxHeight: 240,
                      resize: "none",
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      fontSize: 14,
                      fontFamily: CHAT_FONT,
                      color: themeColors.text,
                      lineHeight: 1.4,
                    }}
                  />
                  <select value={chatProvider} onChange={(e) => setChatProvider(e.target.value)} style={{ flexShrink: 0, padding: "4px 6px", fontSize: 13, alignSelf: "center", maxWidth: 140, fontFamily: CHAT_FONT }}>
                    {Object.entries(AI_PROVIDERS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <button type="button" className="btn btn-primary" onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()} style={{ padding: "8px 14px", fontSize: 12, fontFamily: CHAT_FONT }}>Send</button>
                </div>
              </div>
            </>
          )}
          {!isMin && (
            <div
              onMouseDown={handleResizeMouseDown}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 16,
                height: 16,
                cursor: "nwse-resize",
                background: `linear-gradient(135deg, transparent 50%, ${themeColors.border} 50%)`,
                backgroundSize: "8px 8px",
              }}
              title="Resize"
            />
          )}
        </div>
        );
      })()}

      {/* ── MODALS ── */}
      {showImportModal && importTargetPersonId != null && <ImportModal getApiKey={getApiKey} onClose={() => { setShowImportModal(false); setImportTargetPersonId(null); }} onImport={(date, biomarkers, extractedName, extractedNameEnglish, importedFile, extraEntries) => {
          if (Array.isArray(extraEntries) && extraEntries.length > 0) {
            let next = entries;
            const baseId = Date.now();
            extraEntries.forEach((e, i) => {
              next = {
                ...next,
                [importTargetPersonId]: [...(next[importTargetPersonId] || []), { date: e.date, biomarkers: e.biomarkers || {}, id: baseId + i, extractedName: undefined, extractedNameEnglish: undefined, importedFile: undefined }]
                  .sort((a, b) => new Date(a.date) - new Date(b.date)),
              };
            });
            setEntries(next);
            save(people, next);
          } else {
            addEntry(importTargetPersonId, date, biomarkers, extractedName, extractedNameEnglish, importedFile);
          }
          setShowImportModal(false);
          setImportTargetPersonId(null);
        }} personName={people.find(p => p.id === importTargetPersonId)?.name} />}
      {showManualEntry && <ManualEntryModal onClose={() => setShowManualEntry(false)} onSave={(date, biomarkers) => { addEntry(selectedPerson, date, biomarkers); setShowManualEntry(false); }} person={currentPerson} />}
      {showAddPersonModal && <AddPersonModal onClose={() => setShowAddPersonModal(false)} onAdd={addPerson} />}
      {showEditPersonModal && currentPerson && (
        <EditPersonModal
          person={currentPerson}
          onClose={() => setShowEditPersonModal(false)}
          onSave={(updates) => { updatePerson(currentPerson.id, updates); setShowEditPersonModal(false); }}
        />
      )}
      {showInfoModal && <InfoModal name={showInfoModal} onClose={() => setShowInfoModal(null)} latestEntry={latestEntry} themeColors={themeColors} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} person={currentPerson} personEntries={personEntries} cumulativeSnapshot={cumulativeSnapshot} getBirthdayDisplay={getBirthdayDisplay} getAge={getAge} />}
      {viewOriginalFile && <ViewOriginalModal file={viewOriginalFile} onClose={() => setViewOriginalFile(null)} themeColors={themeColors} />}
      {showApiKeysModal && (
        <div className="modal-bg" onClick={() => setShowApiKeysModal(false)} role="presentation">
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 16, fontSize: 16, fontWeight: 600, color: themeColors.accent }}>API keys & WHOOP</div>
            <div style={{ fontSize: 12, color: themeColors.textDim, marginBottom: 16, lineHeight: 1.5 }}>
              AI provider keys are used for chat and PDF/image import. WHOOP fields are your OAuth <strong>app</strong> credentials from the{" "}
              <a href="https://developer.whoop.com/" target="_blank" rel="noreferrer" style={{ color: themeColors.accent }}>
                WHOOP Developer Dashboard
              </a>
              . Everything here is included when you <strong>Export backup (JSON)</strong> (<code style={{ fontSize: 11 }}>settings</code> +{" "}
              <code style={{ fontSize: 11 }}>whoopCache</code>
              ). {driveToken && driveFileId ? "Stored in your Google Drive when connected." : "Stored on this device."} Keys are not sent to this app&apos;s
              server.
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: themeColors.textMuted, marginBottom: 10, letterSpacing: 0.5 }}>AI providers</div>
            {["gemini", "anthropic", "openai", "groq"].map((p) => (
              <div key={p} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: themeColors.textDim, marginBottom: 4, textTransform: "capitalize" }}>{p}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type={apiKeyVisible[p] ? "text" : "password"}
                    autoComplete="off"
                    placeholder={p === "gemini" ? "AI Studio key" : p === "anthropic" ? "sk-ant-..." : p === "openai" ? "sk-..." : "gsk_..."}
                    value={apiKeysDraft[p] || ""}
                    onChange={(e) => setApiKeysDraft((prev) => ({ ...prev, [p]: e.target.value }))}
                    style={{ fontFamily: "monospace", fontSize: 12, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setApiKeyVisible((prev) => ({ ...prev, [p]: !prev[p] }))}
                    style={{ padding: "8px 10px", background: themeColors.border, border: "none", borderRadius: 6, color: themeColors.textMuted, cursor: "pointer", fontSize: 14 }}
                    title={apiKeyVisible[p] ? "Hide" : "Show"}
                    aria-label={apiKeyVisible[p] ? "Hide key" : "Show key"}
                  >
                    {apiKeyVisible[p] ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
            ))}

            <div
              style={{
                margin: "20px 0 12px",
                paddingTop: 16,
                borderTop: `1px solid ${themeColors.border}`,
                fontSize: 11,
                fontWeight: 600,
                color: themeColors.textMuted,
                letterSpacing: 0.5,
              }}
            >
              WHOOP OAuth app (Client ID / secret)
            </div>
            <div
              style={{
                fontSize: 11,
                color: themeColors.textDim,
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${themeColors.border}`,
                background: `${themeColors.accent}08`,
                lineHeight: 1.5,
              }}
            >
              Register a <strong>Redirect URL</strong> in the WHOOP app that matches the effective URI below (exact string).{" "}
              <code style={{ color: themeColors.accent }}>invalid_request</code> means a mismatch.
            </div>
            <div style={{ fontSize: 11, color: themeColors.textDim, marginBottom: 4 }}>Effective redirect URI (for WHOOP dashboard)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <code
                style={{
                  flex: "1 1 200px",
                  color: themeColors.accent,
                  fontSize: 11,
                  wordBreak: "break-all",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `1px solid ${themeColors.border}`,
                  background: themeColors.appBg,
                }}
              >
                {getWhoopRedirectUri((whoopCredentialsDraft.redirectUri || "").trim()) || "—"}
              </code>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 11, flexShrink: 0 }}
                onClick={() => {
                  const u = getWhoopRedirectUri((whoopCredentialsDraft.redirectUri || "").trim());
                  if (u && navigator.clipboard?.writeText) void navigator.clipboard.writeText(u);
                }}
                disabled={!getWhoopRedirectUri((whoopCredentialsDraft.redirectUri || "").trim())}
              >
                Copy
              </button>
            </div>
            {typeof window !== "undefined" && !(whoopCredentialsDraft.redirectUri || "").trim() && (
              <div style={{ fontSize: 10, color: themeColors.textDim, marginBottom: 10 }}>
                Auto-detected from this tab: <code>{resolveWhoopRedirectUri()}</code>
              </div>
            )}
            <label style={{ display: "block", fontSize: 11, color: themeColors.textDim, marginBottom: 4 }}>Redirect URI override (optional)</label>
            <input
              type="url"
              autoComplete="off"
              value={whoopCredentialsDraft.redirectUri || ""}
              onChange={(e) => setWhoopCredentialsDraft((prev) => ({ ...prev, redirectUri: e.target.value }))}
              placeholder="Leave empty for auto-detect or VITE_WHOOP_REDIRECT_URI"
              style={{ width: "100%", marginBottom: 12, fontFamily: "monospace", fontSize: 12 }}
            />
            <label style={{ display: "block", fontSize: 11, color: themeColors.textDim, marginBottom: 4 }}>Client ID</label>
            <input
              type="text"
              autoComplete="off"
              value={whoopCredentialsDraft.clientId}
              onChange={(e) => setWhoopCredentialsDraft((prev) => ({ ...prev, clientId: e.target.value }))}
              placeholder="WHOOP Developer Dashboard"
              style={{ width: "100%", marginBottom: 12, fontFamily: "monospace", fontSize: 12 }}
            />
            <label style={{ display: "block", fontSize: 11, color: themeColors.textDim, marginBottom: 4 }}>Client Secret (optional)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
              <input
                type={whoopClientSecretVisible ? "text" : "password"}
                autoComplete="off"
                value={whoopCredentialsDraft.clientSecret}
                onChange={(e) => setWhoopCredentialsDraft((prev) => ({ ...prev, clientSecret: e.target.value }))}
                placeholder="If token exchange requires it"
                style={{ fontFamily: "monospace", fontSize: 12, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setWhoopClientSecretVisible((v) => !v)}
                style={{ padding: "8px 10px", background: themeColors.border, border: "none", borderRadius: 6, color: themeColors.textMuted, cursor: "pointer", fontSize: 14 }}
                title={whoopClientSecretVisible ? "Hide" : "Show"}
                aria-label={whoopClientSecretVisible ? "Hide client secret" : "Show client secret"}
              >
                {whoopClientSecretVisible ? "🙈" : "👁"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const nextWhoop = {
                    ...whoopSettings,
                    clientId: whoopCredentialsDraft.clientId.trim(),
                    clientSecret: whoopCredentialsDraft.clientSecret,
                    redirectUri: whoopCredentialsDraft.redirectUri.trim(),
                  };
                  save(people, entries, { apiKeysOverride: apiKeysDraft, whoopSettingsOverride: nextWhoop });
                  setWhoopSyncState({ status: "ok", message: "Saved API keys and WHOOP app settings." });
                  setShowApiKeysModal(false);
                }}
              >
                {driveToken && driveFileId ? "Save to Drive" : "Save"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowApiKeysModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TrendDetail is imported from src/components/TrendDetail.jsx

// ─── IMPORT MODAL (AI/Cyrillic/Norwegian/pdfToImages are in src/lib and src/parsers) ───
// personName is used ONLY for UI (e.g. "Differs from profile (Zoya)"). It must NEVER be sent to the AI — extraction is from the document only.
function ImportModal({ getApiKey, onClose, onImport, personName }) {
  const [stage, setStage] = useState("upload");
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importStatus, setImportStatus] = useState("");
  const [importElapsed, setImportElapsed] = useState(0);
  const [editedBiomarkers, setEditedBiomarkers] = useState({});
  const [aiProvider, setAiProvider] = useState("groq"); // "gemini" | "anthropic" | "openai" | "groq"
  const fileRef = useRef();

  useEffect(() => {
    if (!loading) return;
    setImportElapsed(0);
    const t = setInterval(() => setImportElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const toBase64 = (f) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  // Mime type for Gemini: PDF or supported image (jpeg, png, webp)
  const getGeminiMimeType = (f) => {
    const t = (f?.type || "").toLowerCase();
    if (t === "application/pdf") return "application/pdf";
    if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
    if (t === "image/png") return "image/png";
    if (t === "image/webp") return "image/webp";
    const name = (f?.name || "").toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    return "application/pdf";
  };

  const isAcceptedFile = (f) => {
    const t = (f?.type || "").toLowerCase();
    const name = (f?.name || "").toLowerCase();
    return t === "application/pdf" || name.endsWith(".pdf") ||
      t === "image/jpeg" || t === "image/jpg" || t === "image/png" || t === "image/webp" ||
      name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp") ||
      t === "application/json" || name.endsWith(".json");
  };

  // Auto-process as soon as a file is chosen; show spinner immediately so we never show "Processing automatically…" without progress
  const handleFileChange = (e) => {
    const chosen = e.target.files[0];
    if (chosen) {
      setFile(chosen);
      setError(null);
      setLoading(true);
      setImportStatus("Starting…");
      processFile(chosen);
    }
  };

  const processFile = async (chosenFile) => {
    const f = chosenFile || file;
    if (!f) {
      setLoading(false);
      return;
    }
    if (typeof getApiKey !== "function") {
      setError("Import configuration error. Please refresh the page.");
      setLoading(false);
      return;
    }
    const isDev = import.meta.env.DEV;
    const geminiKey = getApiKey("gemini");
    const anthropicKey = getApiKey("anthropic");
    const openaiKey = getApiKey("openai");
    const groqKey = getApiKey("groq");
    if (aiProvider === "gemini" && !geminiKey) {
      setError("Gemini API key not set. Open Tools → API keys and add your key (from aistudio.google.com), or set VITE_GEMINI_API_KEY in .env.");
      setLoading(false);
      return;
    }
    if (aiProvider === "anthropic" && !anthropicKey) {
      const checklist = isDev
        ? " In dev: add to .env one line: VITE_ANTHROPIC_API_KEY=sk-ant-api03-... (no quotes, no space after =). Or set ANTHROPIC_API_KEY in your shell so the proxy can use it. Restart the dev server after changing .env."
        : " Set VITE_ANTHROPIC_API_KEY in .env for production builds.";
      setError("Anthropic API key not set or not visible to the app. " + checklist);
      setLoading(false);
      return;
    }
    if (aiProvider === "openai" && !openaiKey) {
      const checklist = isDev
        ? " In dev: add VITE_OPENAI_API_KEY=sk-... to .env in the project root and restart the dev server."
        : " Set VITE_OPENAI_API_KEY in .env for production builds.";
      setError("OpenAI API key not set or not visible to the app. " + checklist);
      setLoading(false);
      return;
    }
    if (aiProvider === "groq" && !groqKey) {
      setError("Groq API key not set. Open Tools → API keys and add your key (from console.groq.com), or set VITE_GROQ_API_KEY in .env.");
      setLoading(false);
      return;
    }
    const fileName = (f.name || "").toLowerCase();
    if (fileName.endsWith(".json") || (f.type || "").toLowerCase() === "application/json") {
      setLoading(true);
      setError(null);
      setImportStatus("Reading Norwegian lab history…");
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        const parsed = Array.isArray(data) ? parseNorwegianAnalysehistorikk(data) : parseNorwegianAnalysehistorikk(data?.analyser || data?.entries || []);
        const entries = parsed.entries || [];
        if (entries.length === 0) {
          setError("No valid lab entries found in the JSON file. Expected Norwegian analysehistorikk format.");
          setLoading(false);
          return;
        }
        setResult({ source: "norwegian-json", entries });
        setEditedBiomarkers(entries[0]?.biomarkers || {});
        setDate(entries[0]?.date || new Date().toISOString().split("T")[0]);
        setStage("review");
      } catch (e) {
        setError("Invalid or unsupported JSON: " + (e?.message || String(e)));
      }
      setLoading(false);
      setImportStatus("");
      return;
    }
    const isPdf = (file) => (file?.type === "application/pdf") || (file?.name && file.name.toLowerCase().endsWith(".pdf"));
    setLoading(true);
    setError(null);
    setImportStatus("Reading file…");
    setImportElapsed(0);
    const IMPORT_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes
    const aborter = new AbortController();
    const timeoutId = setTimeout(() => aborter.abort(), IMPORT_TIMEOUT_MS);
    try {
      const b64 = await toBase64(f);
      const providerName = aiProvider === "anthropic" ? "Claude" : aiProvider === "openai" ? "OpenAI" : aiProvider === "groq" ? "Groq" : aiProvider === "ollama" ? "Llama (local)" : "Gemini";
      setImportStatus(`Sending document to ${providerName}…`);
      const targetUnits = Object.fromEntries(Object.entries(BIOMARKER_DB).map(([k, v]) => [k, v.unit]));

      // IMPORTANT: Do not pass the selected person's name or any profile data into the prompt. The AI must extract only from the document.
      const prompt = `You are a precision medical document parser specializing in international laboratory reports.
The input is a document (PDF or image such as a photo/scan of a lab report). Extract every biomarker you can find from the text or visible content.
The report may be in Norwegian, Russian, Armenian, or English.

BIOCHEMICAL PANEL (Cobas / Կենսաքիմիական): When the document is a biochemical analysis table, extract: GLUC or Գլյուկոզա → Fasting Glucose (mmol/L → mg/dL: ×18.016); BIL-T or Ընդհանուր բիլիռուբին → Bilirubin, Total (μmol/L → mg/dL: ÷17.1); GGT or y-գլյուտամիլտրանսպեպտիդազ → GGT (U/L); ALP or Հիմնային ֆոսֆատազ → Alkaline Phosphatase (U/L). Do not skip these when the table has "Biochemical analysis" or "Կենսաքիմիական հետազոտություններ".

CRITICAL — CBC / WBC DIFFERENTIAL: Extract BOTH forms when the report shows both. (1) PERCENTAGE: when you see NEUT%, LYMPH%, MONO%, EO%, BASO% (or Armenian/other labels), add Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils with the numeric % value. (2) ABSOLUTE COUNTS: when you see absolute counts in 10⁹/L or ×10⁹/L or K/μL (e.g. NEUT#, LYMPH#, or a separate column for absolute values), add Neutrophils (Absolute), Lymphocytes (Absolute), Monocytes (Absolute), Eosinophils (Absolute), Basophils (Absolute) with that numeric value. Many reports (e.g. Sysmex) have both % and absolute — extract BOTH. If only one form is present, extract that one.

PATIENT NAME — the ONLY valid source is the field labeled "Patient" or "Բուժառու" or "Name":
- Locate the line where one of these words appears as a label (usually near the top, before date of birth).
- extractedPersonName = the exact text that comes AFTER that label on the same line (or the next line). Copy character-for-character. Same order, same case.
- extractedPersonNameEnglish = that same name in English: format is usually SURNAME GivenName Patronymic → output "GivenName Surname" (word2 + word1; word3 is patronymic, do not use as first name).
- INVALID sources — do NOT use: signature line, "Signed by", "Ordered by", doctor name, clinic/lab name, license, address, footer, stamp, or any name that is not immediately after the "Patient"/"Բուժառու"/"Name" label. If the only names you see are in those places, set extractedPersonName and extractedPersonNameEnglish to null.

URINE TESTS — CRITICAL: If the document is a URINE test (e.g. "General Urine Test", "մեզ", "Urine", "biosample: urine", "Urisys", "urine analysis", "ՄԵԶԻ ՀԵՏԱԶՈՏՈՒԹՅՈՒՆ"), then:
- Do NOT put qualitative urine results into blood/serum biomarkers. Urine "glucose negative" / "նորմա" / "բացասական" is a presence check, NOT Fasting Glucose (blood). Urine "protein negative" is NOT Total Protein (serum) — use "Urine Protein" only if you have a numeric value or use 0 with a note. Urine "creatinine" in a dipstick context is NOT serum Creatinine.
- Only extract from urine reports: Specific Gravity (Urine), pH (Urine), Urine Protein (when numeric or negative→0), Urine Albumin, Urine Creatinine — when the report gives a numeric or clearly quantitative value. For qualitative results (negative, normal, positive) you may summarize in "notes" (e.g. "Urine: glucose neg, protein neg") but do NOT add Fasting Glucose, Creatinine, Total Protein, Bilirubin, etc. to "extracted" from those.
- Blood/serum panels: extract as usual.

ALSO extract:
1) The test/collection date from the document (look for date of collection, sample date, report date, etc.).
2) Patient name: use the PATIENT NAME rules above (extractedPersonName = text after "Patient"/"Բուժառու"; extractedPersonNameEnglish = GivenName Surname from that, second word = given name).

TARGET UNITS — you MUST convert every value to these exact units before returning:
${JSON.stringify(targetUnits, null, 2)}

GENERAL RULE FOR ALL BIOMARKERS: For every value you extract, identify the UNIT as stated on the lab report (e.g. g/L, mmol/L, mg/dL, nmol/L). Then convert to the target unit above before putting it in "extracted". Never assume the report uses the target unit — many labs use g/L for Hemoglobin, mmol/L for lipids/glucose, etc. If you output a value without converting from the report's unit, the result will be wrong (e.g. 144 g/L Hemoglobin must become 14.4 g/dL, not 144).

MANDATORY UNIT CONVERSION REFERENCE (apply these to every value):
Lipids / Cholesterol (Total Cholesterol, LDL Cholesterol, HDL Cholesterol):
  - mmol/L → mg/dL: multiply by 38.67
  - If already mg/dL: no change
Triglycerides:
  - mmol/L → mg/dL: multiply by 88.57
  - If already mg/dL: no change
ApoB: mg/dL target; g/L → mg/dL: × 100
ApoA-1: mg/dL target; g/L → mg/dL: × 100 (Apolipoprotein A1, HDL protein; higher is better)
Lp(a): nmol/L target; mg/dL → nmol/L: × 2.5; mg/L → nmol/L: × 0.25
Fasting Glucose: mg/dL target; mmol/L → mg/dL: × 18.016
HbA1c: % (NGSP) target; mmol/mol (IFCC) → %: (mmol/mol / 10.929) + 2.15
Fasting Insulin: μIU/mL target; pmol/L → μIU/mL: ÷ 6.945; mU/L = μIU/mL (no change)
Hemoglobin: g/dL target; g/L → g/dL: ÷ 10 (e.g. 144 g/L → 14.4 g/dL; do not output 144 if lab unit is g/L)
hs-CRP: mg/L target; mg/dL → mg/L: × 10
Homocysteine: μmol/L target (usually already correct)
ALT, AST, GGT: U/L target; nkat/L → U/L: × 0.0167
Creatinine: mg/dL target; μmol/L → mg/dL: ÷ 88.4; mmol/L → mg/dL: ÷ 0.0884
BUN: mg/dL target; urea mmol/L → BUN mg/dL: × 2.8
Uric Acid: mg/dL target; μmol/L → mg/dL: ÷ 59.48
TSH: mIU/L target (usually already correct)
Free T3: pg/mL target; pmol/L → pg/mL: × 0.651; ng/dL → pg/mL: × 10
Free T4: ng/dL target; pmol/L → ng/dL: × 0.0777
Total Testosterone: ng/dL target; nmol/L → ng/dL: × 28.84
Free Testosterone: pg/mL target; pmol/L → pg/mL: × 0.288; ng/dL → pg/mL: × 100
DHEA-S: μg/dL target; μmol/L → μg/dL: × 36.81
IGF-1: ng/mL target; nmol/L → ng/mL: × 7.649
Estradiol: pg/mL target; if already pg/mL use as-is; pmol/L → pg/mL: × 0.2724; nmol/L → pg/mL: × 272.4 (Norwegian labs often use nmol/L). Recognise as Estradiol: E2, Oestradiol, 17-beta estradiol, 17β-estradiol, S-Østradiol-17beta, S-Oestradiol-17beta — output key must be exactly "Estradiol".
Cortisol: μg/dL target; nmol/L → μg/dL: ÷ 27.59; ng/mL → μg/dL: ÷ 10
Vitamin D: ng/mL target; nmol/L → ng/mL: ÷ 2.496. S-Vitamin D, Vitamin D3, 25-OH vitamin D (Norwegian/lab) all map to Vitamin D — extract and convert.
Vitamin B12 (Total B12 only): pg/mL target; pmol/L → pg/mL: × 1.355. Do NOT apply this to Active B12.
Active B12: pmol/L target. If the lab result is already in pmol/L, use the value as-is — do NOT convert. Active B12 is different from Total B12.
Folate: ng/mL target; nmol/L → ng/mL: ÷ 2.266
Iron: μg/dL target; μmol/L → μg/dL: × 5.585
Magnesium: mg/dL target; mmol/L → mg/dL: × 2.432
Zinc: μg/dL target; μmol/L → μg/dL: × 6.54
Hemoglobin: g/dL target. Many labs report in g/L (e.g. 140–180 g/L for adults). You MUST convert: g/L → g/dL: ÷ 10. Example: 144 g/L = 14.4 g/dL (not 144). If already in g/dL, use as-is.
SHBG: nmol/L target (usually already correct)

Additional biomarkers (use EXACT name from target list; convert to target unit):
Cystatin C: mg/L target; μmol/L → mg/L: ÷ 8.92
Urine Albumin: mg/L target (urine); if reported as mg/dL multiply by 10 for mg/L
Urine Creatinine: mg/dL target (urine; same as serum unit)
Albumin-to-Creatinine Ratio: mg/g target (urine ACR); if reported as mg/mmol multiply by 0.113 for mg/g. Can be computed from Urine Albumin and Urine Creatinine when both from same test.
BUN/Creatinine Ratio: ratio (dimensionless); compute as BUN ÷ Creatinine if reported separately
RDW: % target (usually already correct); Red Cell Distribution Width = RDW
MCV: fL target; Mean Corpuscular Volume (usually already correct)
MCH: pg target; Mean Corpuscular Hemoglobin (usually already correct)
MCHC: g/dL target (usually already correct)
MPV: fL target; Mean Platelet Volume (usually already correct)
WBC differential (CBC) — CRITICAL: Extract percentage values when the report shows them (unit %). Lab abbreviations and names to output keys: NEUT% or NEUT or Նեյտրոֆիլների → Neutrophils; LYMPH% or LYMPH or Լիմֆոցիտների → Lymphocytes; MONO% or MONO or Մոնոցիտների → Monocytes; EO% or EO or էոզինոֆիլների → Eosinophils; BASO% or BASO or Բազոֆիլների → Basophils; IG% or IG or Ոչ հասուն գրանուլոցիտների (immature granulocytes) → Band Neutrophils. Unit is %; use the numeric value as-is. Output exact keys: Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils, Band Neutrophils.
Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils: % target when report gives percentage. Neutrophils (Absolute), Lymphocytes (Absolute), Monocytes (Absolute), Eosinophils (Absolute), Basophils (Absolute): 10⁹/L target when report gives absolute counts (column/row in 10⁹/L or ×10⁹/L or K/μL). When the report has BOTH percentage and absolute for the same cell type, output BOTH the percentage key and the (Absolute) key. Do not omit absolute counts when they are present.
Total Protein: g/dL target; g/L → g/dL: ÷ 10
Albumin: g/dL target; g/L → g/dL: ÷ 10
Globulin: g/dL target; often computed as Total Protein − Albumin
Alkaline Phosphatase: U/L target (usually already correct); ALP = Alkaline Phosphatase
Creatine Kinase: U/L target (usually already correct); S-CK (Norwegian) = Creatine Kinase. Blueprint tracks CK.
Progesterone: ng/mL target; nmol/L → ng/mL: ÷ 3.18. S-Progesteron (Norwegian). Female hormone; extract when reported.
Free Testosterone Index: ratio (dimensionless); Fri Testosteron indeks (Norwegian). Extract when lab reports this calculated index — different from Free Testosterone (mass concentration).
Bilirubin, Total: mg/dL target; μmol/L → mg/dL: ÷ 17.1
TPO Antibodies: IU/mL target; Thyroid peroxidase antibody, anti-TPO (usually already correct)
Thyroglobulin Antibodies: IU/mL target (usually already correct)
Prolactin: ng/mL target; μg/L = ng/mL (no change)
FSH, LH: mIU/mL target (usually already correct)
Vitamin A: μg/dL target; μmol/L → μg/dL: × 28.6
Calcium: mg/dL target; mmol/L → mg/dL: × 4. Extract total calcium (S-Kalsium, Kalsium when not corrected) as "Calcium".
Corrected Calcium: mg/dL target; mmol/L → mg/dL: × 4. Extract S-Kalsium korrigert, corrected calcium, albumin-corrected calcium as "Corrected Calcium". When the report has both total and corrected, extract BOTH.
Sodium, Potassium, Chloride: mEq/L or mmol/L (usually same numeric)
Carbon Dioxide: mEq/L (bicarbonate; usually already correct)
Serum pH: pH units (blood/serum; usually already correct; distinct from pH (Urine))
Phosphate: mg/dL target; mmol/L → mg/dL: × 3.1
Selenium: μg/L target (usually already correct)
Copper: μg/dL target; μmol/L → μg/dL: × 6.35
Iodine: μg/L target (urine or serum; usually already correct)
CoQ10: μg/mL target (usually already correct)
Glutathione: μmol/L target (whole blood or RBC; lab-dependent)
PIVKA-II: mAU/mL target; DCP, des-gamma-carboxy prothrombin (usually already correct)
Non-HDL Cholesterol: mg/dL target; compute as Total Cholesterol − HDL Cholesterol if not reported
LDL Particle Number: nmol/L target (Ldl Particle Number, LDL-P; usually already correct)
Lipase, Amylase: U/L target (usually already correct)
Urine Protein: mg/dL target (Protein (Urine), urine protein; distinct from serum Total Protein)
Specific Gravity (Urine): ratio (e.g. 1.010–1.025; usually already correct)
pH (Urine): pH units (usually already correct)
TIBC: μg/dL target (Iron Binding Capacity, total iron-binding capacity; usually already correct)
Methylmalonic Acid: nmol/L target (MMA; usually already correct)
Leptin: ng/mL target (usually already correct)
Omega-3 Total, Omega-6 Total, EPA+DPA+DHA: % target when reported as % of fatty acids (Omega-3 index style); otherwise use lab unit
Omega-6/Omega-3 Ratio: ratio (dimensionless)
Lead: μg/dL target (blood lead; usually already correct)
Mercury: μg/L target (Mercury Blood; usually already correct)
Rheumatoid Factor: IU/mL target (usually already correct)
ANA Screen: titer or positive/negative (Antinuclear Antibodies Screen; output numeric if titer e.g. 1:40 as 40, or 0 if negative)
Band Neutrophils: % target (CBC; usually already correct)
Cholesterol/HDL Ratio: ratio; compute as Total Cholesterol ÷ HDL Cholesterol if not reported
ApoB/ApoA-1 Ratio: ratio; compute as ApoB ÷ ApoA-1 when both are reported (do not report if only one is present)
Albumin/Globulin Ratio: ratio; compute as Albumin ÷ Globulin if not reported
Iron Saturation: % target; compute as (Iron ÷ TIBC)×100 if not reported (Iron % Saturation)
Recognise aliases: GLUC = Fasting Glucose, GLU = Fasting Glucose, Glucose = Fasting Glucose. BIL-T = Bilirubin, Total (output key exactly "Bilirubin, Total"). GGT = GGT, ALP = Alkaline Phosphatase. Holotranscobalamin = Active B12, holoTC = Active B12, Vitamin B12 (total) = Total B12, Glucose (fasting) = Fasting Glucose, CRP (hs) = hs-CRP, GGT = Gamma Glutamyl Transferase, eGFR = eGFR (estimated GFR). Apo A-1 = ApoA-1, Apolipoprotein A1 = ApoA-1. CBC differential: NEUT% = Neutrophils, LYMPH% = Lymphocytes, MONO% = Monocytes, EO% = Eosinophils, BASO% = Basophils, IG% = Band Neutrophils. Norwegian: Bilirubin or Total bilirubin → output key exactly "Bilirubin, Total" (comma included). Blueprint names: Non Hdl Cholesterol = Non-HDL Cholesterol, Protein (Urine) = Urine Protein, White Blood Cell Count = WBC, Red Blood Cell Count = RBC, Platelet Count = Platelets, Triiodothyronine (T3 Free) = Free T3, Thyroxine (T4 Free) = Free T4, Thyroid Stimulating Hormone = TSH, Testosterone Total = Total Testosterone, Testosterone Free = Free Testosterone, Urea Nitrogen (Bun) = BUN, Estimated Glomerular Filtration Rate = eGFR, Hemoglobin A1C = HbA1c, High-Sensitivity C-Reactive Protein = hs-CRP, Sex Hormone Binding Globulin = SHBG, Dhea Sulfate = DHEA-S, Iron Binding Capacity = TIBC, Iron % Saturation = Iron Saturation, Ldl Particle Number = LDL Particle Number, Chol/Hdlc Ratio = Cholesterol/HDL Ratio, Albumin/Globulin Ratio = Albumin/Globulin Ratio.

LANGUAGE MAPPING (use EXACT English key in extracted output):
Norwegian: Kreatinin=Creatinine, Glukose=Fasting Glucose, Fasting glukose=Fasting Glucose, Kolesterol=Total Cholesterol, Total kolesterol=Total Cholesterol, LDL-kolesterol=LDL Cholesterol, LDL kolesterol=LDL Cholesterol, HDL-kolesterol=HDL Cholesterol, HDL kolesterol=HDL Cholesterol, Triglyserider=Triglycerides, Tyreoideastimulerende hormon=TSH, TSH=TSH, Urinsyre=Uric Acid, Homocystein=Homocysteine, Oestradiol=Estradiol, Østradiol=Estradiol, E2=Estradiol, S-Østradiol-17beta=Estradiol, S-Oestradiol-17beta=Estradiol, Hemoglobin=Hemoglobin, Hb=Hemoglobin, Hematokrit=Hematocrit, Erytrocytter=RBC, Leukocytter=WBC, Hvite blodceller=WBC, Trombocytter=Platelets, Røde blodceller=RBC, Kreatinin (serum)=Creatinine, Ureum=BUN, Urea=BUN, eGFR=eGFR, Estimert GFR=eGFR, ASAT=AST, ALAT=ALT, Gamma-GT=GGT, GGT=GGT, Alkalisk fosfatase=Alkaline Phosphatase, ALP=Alkaline Phosphatase,  Sensitivt CRP=hs-CRP, CRP (sens)=hs-CRP, hs-CRP=hs-CRP, Fri T3=Free T3, fT3=Free T3, Triiodothyronin=Free T3, Fri T4=Free T4, fT4=Free T4, Thyroxin=Free T4, Testosteron=Total Testosterone, Fri testosteron=Free Testosterone, Prolaktin=Prolactin, Kortisol=Cortisol, DHEA-S=DHEA-S, SHBG=SHBG, Kobalamin=Total B12, Vitamin B12=Total B12, Holotranscobalamin=Active B12, Aktiv B12=Active B12, Folat=Folate, Vitamin D=Vitamin D, 25-OH-vitamin D=Vitamin D, 25-hydroxyvitamin D=Vitamin D, Jern=Iron, Ferritin=Ferritin, Total jernbindingskapasitet=TIBC, Jernbindingskapasitet=TIBC, Jernmetning=Iron Saturation, Magnesium=Magnesium, Zink=Zinc, Selen=Selenium, Kalsium=Calcium, S-Kalsium=Calcium, Natrium=Sodium, Kalium=Potassium, Klorid=Chloride, Fosfat=Phosphate, Kopper=Copper, Albumin=Albumin, Total protein=Total Protein, Globulin=Globulin, Cystatin C=Cystatin C, Urin albumin=Urine Albumin, Urin kreatinin=Urine Creatinine, Urin protein=Urine Protein, Protein (urin)=Urine Protein, Neutrofile=Neutrophils, Lymfocytter=Lymphocytes, Monocytter=Monocytes, Eosinofiler=Eosinophils, Basofiler=Basophils, Insulin=Fasting Insulin, Fasting insulin=Fasting Insulin, HbA1c=HbA1c, Glykemisk hemoglobin=HbA1c, TPO-antistoff=TPO Antibodies, Thyroglobulin-antistoff=Thyroglobulin Antibodies, Lipase=Lipase, Amylase=Amylase, Revmatoid faktor=Rheumatoid Factor, MMA=Methylmalonic Acid, Metylmalonsyre=Methylmalonic Acid, S-Kalsium korrigert=Corrected Calcium, S-CK=Creatine Kinase, S-Progesteron=Progesterone, Vitamin D3=Vitamin D, S-Vitamin D=Vitamin D, Fri Testosteron indeks=Free Testosterone Index
Russian: Креатинин=Creatinine, Глюкоза=Fasting Glucose, Холестерин=Total Cholesterol, Триглицериды=Triglycerides, ТТГ=TSH, Мочевая кислота=Uric Acid, Гомоцистеин=Homocysteine, ЛПНП=LDL Cholesterol, ЛПВП=HDL Cholesterol, Гемоглобин=Hemoglobin, Ферритин=Ferritin, Эстрадиол=Estradiol
Armenian: Կրեատինին=Creatinine, Գլյուկոզ=Fasting Glucose, Գլյուկոզա=Fasting Glucose, Խոլեստerոլ=Total Cholesterol, Հեմoglobin=Hemoglobin. Biochemical: Ընդհանուր բիլիռուբին → "Bilirubin, Total", y-գլյուտամիլտրանսպեպտիդազ=GGT, Հիմնային ֆոսֆատազ=Alkaline Phosphatase. CBC differential (Նեյտրոֆիլների=Neutrophils, Լիմֆոցիտների=Lymphocytes, Մոնոցիտների=Monocytes, էոզինոֆիլների=Eosinophils, Բազոֆիլների=Basophils, Ոչ հասուն գրանուլոցիտների=Band Neutrophils). ESR: էրիթրոցիտների նստեցման արագություն=ESR
English: E2=Estradiol, Oestradiol=Estradiol, 17-beta estradiol=Estradiol

CHECKLIST — CBC: Extract percentage values as Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils (unit %). Also extract absolute counts when present (e.g. NEUT#, LYMPH# in 10⁹/L) as Neutrophils (Absolute), Lymphocytes (Absolute), etc. Do not skip absolute counts when the report includes them.

Return ONLY valid JSON. No markdown, no explanation, no newlines inside any string. Keep "notes" and "conversions" very short (one short phrase each). When CBC differential % are present, include them in extracted. Example shape (include both % and absolute when report has both): {"extracted":{"Hemoglobin":"14.2","Neutrophils":"55","Lymphocytes":"35","Monocytes":"6","Eosinophils":"2","Basophils":"1","Neutrophils (Absolute)":"3.2","Lymphocytes (Absolute)":"2.1",...},"conversions":{},"testDate":"YYYY-MM-DD or null","extractedPersonName":null,"extractedPersonNameEnglish":null,"language":"en","notes":""}

Critical rules:
- CBC differential: If the report has percentage columns (NEUT%, LYMPH%, etc.), add Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils (value in %). If it also has absolute count columns (e.g. NEUT#, 10⁹/L), add Neutrophils (Absolute), Lymphocytes (Absolute), Monocytes (Absolute), Eosinophils (Absolute), Basophils (Absolute) (value in 10⁹/L). Extract both when both are present.
- Patient name: extractedPersonName must be the exact text that follows the label "Patient" or "Բուժառու" or "Name" on the document. Do not use a name from a signature, stamp, "Signed by", doctor, clinic, or any other field — only the line that is explicitly the patient field. If unsure, use null.
- URINE reports: Do not add Fasting Glucose, Creatinine (serum), Total Protein, Bilirubin, etc. from qualitative urine results (negative/normal/բացասական/նորմա). Only add urine-specific biomarkers (Specific Gravity (Urine), pH (Urine), Urine Protein, Urine Albumin, Urine Creatinine) when the report gives a numeric value.
- For every biomarker: detect the unit as stated on the report (g/L, mmol/L, mg/dL, etc.) and convert to the target unit before adding to "extracted". Never assume the lab uses the target unit — e.g. Hemoglobin 144 g/L → 14.4 g/dL; glucose 5.5 mmol/L → 99 mg/dL.
- Values in "extracted" MUST already be in the target units after conversion
- Use EXACT biomarker names from the target units object (e.g. "Estradiol" not "E2", "Active B12" not "B12 active").
- Estradiol: if pg/mL keep value; if pmol/L × 0.2724 → pg/mL; if nmol/L × 272.4 → pg/mL (e.g. Norwegian S-Østradiol-17beta in nmol/L).
- Active B12 and Total B12 (Vitamin B12) are different: Active B12 target unit is pmol/L — when the lab reports Active B12 in pmol/L, do NOT convert (no × 1.355). Only Total B12 / Vitamin B12 uses pg/mL and that conversion.
- Round sensibly: creatinine 2dp, glucose 1dp, lipids 0dp, hormones 1dp
- Only include biomarkers you are confident about` + (aiProvider === "groq" ? `

REMINDER — Patient name: Only the text that follows "Patient" or "Բուժառու" or "Name" is valid. Do NOT use a name from signature, "Signed by", doctor, clinic, stamp, or footer.` : "");

      const repairJsonString = (str) => {
        let out = "";
        let inString = false;
        let escape = false;
        const quote = '"';
        for (let i = 0; i < str.length; i++) {
          const c = str[i];
          if (escape) {
            out += c;
            escape = false;
            continue;
          }
          if (c === "\\") {
            out += c;
            escape = true;
            continue;
          }
          if (c === quote) {
            inString = !inString;
            out += c;
            continue;
          }
          if (inString && (c === "\n" || c === "\r")) {
            out += " ";
            continue;
          }
          out += c;
        }
        return out;
      };

      const tryRepairTruncated = (str) => {
        let s = str.trim();
        let inString = false;
        let escape = false;
        let depth = 0;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (c === "\\" && inString) {
            escape = true;
            continue;
          }
          if ((c === '"') && (i === 0 || s[i - 1] !== "\\")) inString = !inString;
          if (!inString) {
            if (c === "{") depth++;
            else if (c === "}") depth--;
          }
        }
        if (inString) s += '"';
        while (depth > 0) {
          s += "}";
          depth--;
        }
        return s;
      };

      const parseGeminiJson = (rawText) => {
        const cleaned = repairJsonString(rawText);
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        const slice = firstBrace !== -1 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
        const candidates = [slice, cleaned, tryRepairTruncated(slice), tryRepairTruncated(cleaned)];
        for (const candidate of candidates) {
          try {
            const p = JSON.parse(candidate);
            if (p && typeof p.extracted === "object") return p;
          } catch (_) {}
        }
        return null;
      };

      let parsed = null;

      if (aiProvider === "anthropic") {
        const apiUrl = isDev ? "/api/anthropic" : "https://api.anthropic.com/v1/messages";
        const headers = { "Content-Type": "application/json", "anthropic-version": "2023-06-01" };
        if (anthropicKey) headers["x-api-key"] = anthropicKey;
        const mimeType = f.type || (f.name && f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
        const mediaType = mimeType === "application/pdf" ? "application/pdf" : (mimeType === "image/png" ? "image/png" : mimeType === "image/webp" ? "image/webp" : "image/jpeg");
        if (mediaType === "application/pdf") headers["anthropic-beta"] = "pdfs-2024-09-25";
        const contentBlocks = [];
        if (mediaType === "application/pdf") {
          contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
        } else {
          contentBlocks.push({ type: "image", source: { type: "base64", media_type, data: b64 } });
        }
        contentBlocks.push({ type: "text", text: prompt });
        const requestBody = { model: "claude-3-5-sonnet-20241022", max_tokens: 2000, messages: [{ role: "user", content: contentBlocks }] };
        const bodyString = JSON.stringify(requestBody);
        const requestSizeBytes = new TextEncoder().encode(bodyString).length;
        const requestSizeMB = (requestSizeBytes / (1024 * 1024)).toFixed(2);
        setImportStatus("Waiting for Claude response…");
        for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
          const response = await fetch(apiUrl, { method: "POST", headers, body: bodyString, signal: aborter.signal });
          if (!response.ok) {
            const errBody = await response.text();
            if (response.status === 401 || response.status === 403) {
              const hint = isDev
                ? " In .env use exactly one line: VITE_ANTHROPIC_API_KEY=sk-ant-api03-... (no quotes, no space after =). Or set ANTHROPIC_API_KEY for the dev proxy. Restart the dev server after any change. If the key looks correct, create a new key at console.anthropic.com and replace it."
                : " Set VITE_ANTHROPIC_API_KEY in your build env. Create or rotate the key at console.anthropic.com if needed.";
              throw new Error("Anthropic rejected the API key (invalid or missing). " + hint);
            }
            if (response.status === 429) throw new Error("Anthropic rate limit exceeded. Wait a minute and retry.");
            const shortBody = errBody.length > 300 ? errBody.slice(0, 300) + "…" : errBody;
            const plain = shortBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || String(response.status);
            const gatewayErr = response.status === 502 || response.status === 503 || response.status === 504;
            if (gatewayErr && attempt === 0) {
              await new Promise(r => setTimeout(r, 2500));
              continue;
            }
            let diag = "";
            if (gatewayErr) {
              const cfRay = response.headers.get("cf-ray");
              const sizeHint = requestSizeBytes > 5 * 1024 * 1024 ? ` Request body is ${requestSizeMB} MB (Anthropic limit 32 MB); large payloads can trigger 502 — try a smaller file or an image instead of PDF.` : ` Request body ${requestSizeMB} MB.`;
              diag = sizeHint + (cfRay ? ` Cloudflare request ID: ${cfRay}.` : "") + " Often temporary — retry later or use Gemini.";
            }
            throw new Error(`Anthropic API error ${response.status}: ${plain}${diag}`);
          }
          const data = await response.json();
          const text = (data.content || []).map((i) => (i && i.text) || "").join("");
          if (!text.trim()) throw new Error("Claude returned no text; try another file.");
          setImportStatus("Parsing results…");
          const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
          parsed = parseGeminiJson(clean);
        }
      } else if (aiProvider === "openai") {
        const openaiKey = getApiKey("openai");
        const openaiBase = isDev ? "/api/openai" : "https://api.openai.com";
        let imageUrls;
        if (isPdf(f)) {
          setImportStatus("Converting PDF to images…");
          const PDF_CONVERT_MS = 90_000;
          try {
            imageUrls = await Promise.race([
              pdfToImages(b64),
              new Promise((_, reject) => setTimeout(() => reject(new Error("PDF conversion timed out after 90s. Try a smaller file or use Gemini/Claude.")), PDF_CONVERT_MS)),
            ]);
          } catch (e) {
            throw new Error(e?.message?.includes("timed out") ? e.message : "Failed to convert PDF to images: " + (e?.message || String(e)));
          }
          if (!imageUrls?.length) throw new Error("PDF had no renderable pages.");
        } else {
          const imageMime = f.type || (f.name && f.name.toLowerCase().endsWith(".webp") ? "image/webp" : f.name && f.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
          imageUrls = [`data:${imageMime};base64,${b64}`];
        }
        const contentParts = imageUrls.map((url) => ({ type: "image_url", image_url: { url } }));
        contentParts.push({ type: "text", text: prompt });
        const openaiBody = {
          model: "gpt-4o",
          messages: [{ role: "user", content: contentParts }],
          max_tokens: 2000,
        };
        setImportStatus("Waiting for OpenAI response…");
        const openaiRes = await fetch(`${openaiBase}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(openaiKey ? { Authorization: `Bearer ${openaiKey}` } : {}) },
          body: JSON.stringify(openaiBody),
          signal: aborter.signal,
        });
        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          if (openaiRes.status === 401 || openaiRes.status === 403) {
            const hint = isDev ? " Check VITE_OPENAI_API_KEY in .env and restart the dev server." : " Check VITE_OPENAI_API_KEY in your build env.";
            throw new Error("OpenAI rejected the API key (invalid or missing). " + hint);
          }
          if (openaiRes.status === 429) {
            throw new Error("OpenAI quota exceeded (billing required). Switch to Gemini or Claude (free tier) above and try again.");
          }
          throw new Error(`OpenAI API error ${openaiRes.status}: ${(errText || String(openaiRes.status)).slice(0, 300)}`);
        }
        const openaiData = await openaiRes.json();
        const openaiText = openaiData?.choices?.[0]?.message?.content ?? "";
        if (!openaiText.trim()) throw new Error("OpenAI returned no text; try another image.");
        setImportStatus("Parsing results…");
        const clean = openaiText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        parsed = parseGeminiJson(clean);
      } else if (aiProvider === "groq") {
        const groqKey = getApiKey("groq");
        const groqBase = isDev ? "/api/groq" : "https://api.groq.com";
        let imageUrls;
        if (isPdf(f)) {
          setImportStatus("Converting PDF to images…");
          const PDF_CONVERT_MS = 90_000;
          try {
            imageUrls = (await Promise.race([
              pdfToImages(b64, 5),
              new Promise((_, reject) => setTimeout(() => reject(new Error("PDF conversion timed out after 90s. Try a smaller file or use Gemini/Claude.")), PDF_CONVERT_MS)),
            ])).slice(0, 5);
          } catch (e) {
            throw new Error(e?.message?.includes("timed out") ? e.message : "Failed to convert PDF to images: " + (e?.message || String(e)));
          }
          if (!imageUrls?.length) throw new Error("PDF had no renderable pages.");
        } else {
          const imageMime = f.type || (f.name && f.name.toLowerCase().endsWith(".webp") ? "image/webp" : f.name && f.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
          imageUrls = [`data:${imageMime};base64,${b64}`];
        }
        const contentParts = imageUrls.map((url) => ({ type: "image_url", image_url: { url } }));
        contentParts.push({ type: "text", text: prompt });
        const groqBody = {
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: contentParts }],
          max_tokens: 2000,
        };
        setImportStatus("Waiting for Groq response…");
        const groqRes = await fetch(`${groqBase}/openai/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(groqKey ? { Authorization: `Bearer ${groqKey}` } : {}) },
          body: JSON.stringify(groqBody),
          signal: aborter.signal,
        });
        if (!groqRes.ok) {
          const errText = await groqRes.text();
          if (groqRes.status === 401 || groqRes.status === 403) {
            const hint = isDev ? " Check VITE_GROQ_API_KEY in .env and restart the dev server." : " Check VITE_GROQ_API_KEY in your build env.";
            throw new Error("Groq rejected the API key (invalid or missing). Get a key at console.groq.com. " + hint);
          }
          if (groqRes.status === 429) throw new Error("Groq rate limit exceeded. Wait a minute and retry.");
          throw new Error(`Groq API error ${groqRes.status}: ${(errText || String(groqRes.status)).slice(0, 300)}`);
        }
        const groqData = await groqRes.json();
        const groqText = groqData?.choices?.[0]?.message?.content ?? "";
        if (!groqText.trim()) throw new Error("Groq returned no text; try another file.");
        setImportStatus("Parsing results…");
        const clean = groqText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        parsed = parseGeminiJson(clean);
      } else if (aiProvider === "ollama") {
        const ollamaBase = (import.meta.env.VITE_OLLAMA_BASE_URL || "").trim() || (isDev ? "/api/ollama" : "http://localhost:11434");
        const ollamaModel = (import.meta.env.VITE_OLLAMA_VISION_MODEL || import.meta.env.VITE_OLLAMA_MODEL || "llava").trim();
        let imagesBase64;
        if (isPdf(f)) {
          setImportStatus("Converting PDF to images…");
          const PDF_CONVERT_MS = 90_000;
          try {
            const imageUrls = (await Promise.race([
              pdfToImages(b64, 3),
              new Promise((_, reject) => setTimeout(() => reject(new Error("PDF conversion timed out after 90s. Try a smaller file or use Gemini/Claude.")), PDF_CONVERT_MS)),
            ])).slice(0, 3);
            imagesBase64 = imageUrls.map((dataUrl) => (dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl));
          } catch (e) {
            throw new Error(e?.message?.includes("timed out") ? e.message : "Failed to convert PDF to images: " + (e?.message || String(e)));
          }
          if (!imagesBase64?.length) throw new Error("PDF had no renderable pages.");
        } else {
          imagesBase64 = [b64];
        }
        setImportStatus("Waiting for Llama response…");
        const ollamaRes = await fetch(`${ollamaBase}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [{ role: "user", content: prompt, images: imagesBase64 }],
            stream: false,
          }),
          signal: aborter.signal,
        });
        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          if (ollamaRes.status === 404 || /not found|unknown model/i.test(errText)) {
            throw new Error(`Ollama vision model "${ollamaModel}" not found. Run: ollama pull ${ollamaModel} (use a vision model, e.g. llava or gemma3).`);
          }
          throw new Error(`Ollama ${ollamaRes.status}: ${(errText || String(ollamaRes.status)).slice(0, 300)}`);
        }
        const ollamaData = await ollamaRes.json();
        const ollamaText = ollamaData?.message?.content ?? "";
        if (!ollamaText?.trim()) throw new Error("Llama returned no text; try another file or ensure the model supports images (e.g. llava, gemma3).");
        setImportStatus("Parsing results…");
        const clean = ollamaText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        parsed = parseGeminiJson(clean);
      } else {
        const geminiModel = "gemini-2.5-flash";
        const apiBase = isDev ? "/api/gemini" : "https://generativelanguage.googleapis.com";
        const apiUrl = `${apiBase}/v1beta/models/${geminiModel}:generateContent`;
        const headers = { "Content-Type": "application/json" };
        if (geminiKey) headers["x-goog-api-key"] = geminiKey;
        const mimeType = getGeminiMimeType(f);
        const requestBody = {
          contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: b64 } }, { text: prompt }] }],
          generationConfig: { maxOutputTokens: 16384, temperature: 0.1 },
        };
        setImportStatus("Waiting for Gemini response…");
        for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
          const response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(requestBody), signal: aborter.signal });
          if (!response.ok) {
            const errBody = await response.text();
            if (response.status === 401 || response.status === 403) {
              throw new Error(
                "Gemini rejected the request (missing or invalid API key). Add your key under Tools → API keys, or VITE_GEMINI_API_KEY in .env. Get a key at aistudio.google.com/app/apikey"
              );
            }
            if (response.status === 429) {
              throw new Error(
                "Gemini quota exceeded (rate limit or daily free tier). Wait a minute and retry, or check usage at ai.dev/rate-limit. Paid plans get higher limits."
              );
            }
            throw new Error(`API error ${response.status}: ${errBody}`);
          }
          const data = await response.json();
          const candidate = data.candidates?.[0];
          const parts = candidate?.content?.parts;
          if (!Array.isArray(parts)) {
            const blockReason = data.promptFeedback?.blockReason;
            if (blockReason) throw new Error(`Content blocked: ${blockReason}. Try a different file.`);
            throw new Error("Unexpected Gemini response: no text in candidates.");
          }
          const text = parts.map((p) => (p && p.text) || "").join("");
          if (!text.trim()) throw new Error("Gemini returned no text; try another file.");
          setImportStatus("Parsing results…");
          const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
          parsed = parseGeminiJson(clean);
        }
      }

      if (!parsed) {
        throw new Error(
          (aiProvider === "anthropic" ? "Claude" : aiProvider === "openai" ? "OpenAI" : aiProvider === "groq" ? "Groq" : aiProvider === "ollama" ? "Llama" : "Gemini") + " returned invalid or truncated JSON. Try again or use a shorter/simpler document."
        );
      }
      normalizeExtractedBiomarkerKeys(parsed);
      setResult(parsed);
      setEditedBiomarkers(parsed.extracted || {});
      // Auto-fill detected test date
      if (parsed.testDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.testDate)) {
        setDate(parsed.testDate);
      }
      setStage("review");
    } catch (e) {
      if (e.name === "AbortError") {
        setError("Request timed out after 8 minutes. Try a smaller file or another provider.");
      } else {
        setError("Failed to process file: " + e.message);
      }
      setFile(null);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setImportStatus("");
    }
  };

  const getImportMimeType = (f) => {
    if (!f) return "image/jpeg";
    const t = (f.type || "").toLowerCase();
    if (t === "application/pdf") return "application/pdf";
    if (t.startsWith("image/")) return t;
    const name = (f.name || "").toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  };

  const handleConfirm = async () => {
    if (result?.source === "norwegian-json" && Array.isArray(result.entries) && result.entries.length > 0) {
      onImport(null, null, null, null, null, result.entries);
      return;
    }
    const filtered = Object.fromEntries(Object.entries(editedBiomarkers).filter(([k, v]) => v !== "" && v !== undefined));
    const withDerived = computeDerivedBiomarkers(filtered);
    const extractedName = result?.extractedPersonName != null && String(result.extractedPersonName).trim() !== "" ? String(result.extractedPersonName).trim() : null;
    const extractedNameEnglish = result?.extractedPersonNameEnglish != null && String(result.extractedPersonNameEnglish).trim() !== "" ? String(result.extractedPersonNameEnglish).trim() : null;
    const MAX_FILE_SIZE = 4 * 1024 * 1024;
    let importedFile = null;
    if (file && file.size <= MAX_FILE_SIZE) {
      try {
        const data = await toBase64(file);
        importedFile = { mimeType: getImportMimeType(file), data };
      } catch (_) {}
    }
    onImport(date, withDerived, extractedName, extractedNameEnglish, importedFile);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>📄 Import Bloodwork (PDF or Image)</div>
            <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 8 }}>Gemini · Claude · Groq · Llama (local) free tier; OpenAI requires billing. · EN / NO / RU / HY</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(Object.keys(AI_PROVIDERS)).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAiProvider(key)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid " + (aiProvider === key ? "#5a9" : "#2a4a6a"),
                    borderRadius: 8,
                    background: aiProvider === key ? "rgba(85,170,153,0.25)" : "transparent",
                    color: aiProvider === key ? "#8cf" : "#6a8",
                    cursor: "pointer",
                  }}
                >
                  {AI_PROVIDERS[key]}
                  {AI_PROVIDER_FREE_TIER[key] && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.9 }}>(Free)</span>}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {stage === "upload" && (
          <>
            {/* Drop zone — clicking opens file picker which auto-triggers extraction */}
            <div
              onClick={() => !loading && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped && isAcceptedFile(dropped)) {
                  setFile(dropped);
                  setError(null);
                  setLoading(true);
                  setImportStatus("Starting…");
                  processFile(dropped);
                }
              }}
              style={{
                border: `2px dashed ${loading ? "#0ef" : file ? "#0ef" : "#1a3050"}`,
                borderRadius: 12, padding: 48, textAlign: "center",
                cursor: loading ? "default" : "pointer",
                marginBottom: 16, transition: "all 0.2s",
                background: loading ? "rgba(0,238,255,0.06)" : file ? "rgba(0,238,255,0.04)" : "transparent",
              }}>
              <input ref={fileRef} type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,.json,application/json" style={{ display: "none" }} onChange={handleFileChange} />
              {loading ? (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(0,238,255,0.3)", borderTopColor: "#0ef", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
                  <div style={{ color: "#0ef", fontSize: 14, fontWeight: 600 }}>{importStatus || "Analysing document…"}</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 6 }}>
                    {importElapsed > 0 ? `${Math.floor(importElapsed / 60)}m ${importElapsed % 60}s elapsed` : "Detecting language, extracting & converting units"}
                    {importStatus && importStatus.includes("Waiting") ? " · timeout after 8 min" : ""}
                  </div>
                </>
              ) : file ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ color: "#0ef", fontSize: 14, fontWeight: 600 }}>{file.name}</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 4 }}>Processing automatically…</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                  <div style={{ color: "#8aabcc", fontSize: 14, fontWeight: 500 }}>Click or drag & drop your bloodwork (PDF or image)</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 6 }}>PDF, JPEG, PNG, WebP, or .json (Norwegian analysehistorikk) · Auto-detects date & units</div>
                </>
              )}
            </div>

            {error && (
              <div style={{ background: "rgba(255,94,94,0.1)", border: "1px solid rgba(255,94,94,0.3)", borderRadius: 8, padding: 14, fontSize: 12, color: "#ff8888", marginBottom: 16, lineHeight: 1.6 }}>
                <strong style={{ color: "#ff5e5e" }}>⚠ Import failed</strong><br />{error}
                <div style={{ marginTop: 10 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => { setError(null); setFile(null); }}>Try again</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {stage === "review" && result && result.source === "norwegian-json" && (
          <>
            <div style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
              <div style={{ color: RANGE_COLORS.optimal, fontWeight: 600 }}>✓ Norwegian lab history (analysehistorikk.json)</div>
              <div style={{ color: "#4a6a8a", marginTop: 4 }}>{result.entries?.length || 0} test date(s) · biomarkers translated and converted to app units</div>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
              {(result.entries || []).map((entry, idx) => (
                <div key={entry.date || idx} style={{ padding: "10px 12px", borderBottom: "1px solid #0d1c30", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#8aabcc", fontSize: 13 }}>{entry.date}</span>
                  <span style={{ color: "#4a6a8a", fontSize: 12 }}>{Object.keys(entry.biomarkers || {}).length} markers</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => { setStage("upload"); setFile(null); setResult(null); setError(null); }}>← Re-upload</button>
              <button className="btn btn-primary" onClick={handleConfirm}>✓ Import all {result.entries?.length || 0} entries</button>
            </div>
          </>
        )}

        {stage === "review" && result && result.source !== "norwegian-json" && (
          <>
            <div style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: RANGE_COLORS.optimal }}>✓ Language: {result.language}</span>
                <span style={{ color: "#4a6a8a" }}>· {Object.keys(editedBiomarkers).length} markers extracted</span>
                {result.conversions && Object.keys(result.conversions).length > 0 && (
                  <span style={{ color: RANGE_COLORS.sufficient }}>· {Object.keys(result.conversions).length} units converted</span>
                )}
                {result.testDate && <span style={{ color: "#0ef" }}>· Date auto-detected</span>}
              </div>
              {result.extractedPersonName != null && String(result.extractedPersonName).trim() !== "" && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,229,160,0.15)" }}>
                  <span style={{ color: "#5a8ab0" }}>Patient on document: </span>
                  <span style={{ color: "#8aabcc" }}>{result.extractedPersonName}</span>
                  {(personName || "").trim() && !nameAndSurnameMatch(personName, result.extractedPersonNameEnglish, result.extractedPersonName) && (
                    <span style={{ color: "#e8a84a", marginLeft: 8 }}>⚠ Differs from selected profile ({personName})</span>
                  )}
                </div>
              )}
              {result.notes && <div style={{ color: "#4a6a8a", marginTop: 4, fontSize: 11 }}>{result.notes}</div>}
            </div>

            {/* Editable test date */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>TEST DATE {result.testDate ? <span style={{ color: "#0ef", textTransform: "none", letterSpacing: 0 }}>(auto-detected)</span> : <span style={{ color: RANGE_COLORS.sufficient, textTransform: "none", letterSpacing: 0 }}>(not found in document — please set manually)</span>}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ marginTop: 6, maxWidth: 200 }} />
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 16 }}>
              {Object.entries(editedBiomarkers).map(([name, val]) => {
                const status = val ? getStatus(name, val) : null;
                const convNote = result.conversions?.[name];
                return (
                  <div key={name} style={{ padding: "10px 0", borderBottom: "1px solid #0d1c30" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#8aabcc" }}>{BIOMARKER_DB[name]?.icon} {name}</div>
                        {convNote && <div style={{ fontSize: 10, color: RANGE_COLORS.sufficient, marginTop: 2 }}>🔄 {convNote}</div>}
                      </div>
                      <div style={{ fontSize: 10, color: "#3a5a7a", width: 80, textAlign: "right", flexShrink: 0 }}>{BIOMARKER_DB[name]?.unit}</div>
                      <input
                        value={val}
                        onChange={e => setEditedBiomarkers(prev => ({ ...prev, [name]: e.target.value }))}
                        style={{ width: 90, textAlign: "right", flexShrink: 0, borderColor: status ? statusColor(status) + "88" : undefined }}
                      />
                      {status && (
                        <div className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9, flexShrink: 0, width: 70, justifyContent: "center" }}>
                          {status.toUpperCase()}
                        </div>
                      )}
                      <button onClick={() => setEditedBiomarkers(prev => { const n = { ...prev }; delete n[name]; return n; })} style={{ background: "none", border: "none", color: "#3a5a7a", cursor: "pointer", flexShrink: 0, fontSize: 14 }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => { setStage("upload"); setFile(null); setResult(null); setError(null); }}>← Re-upload</button>
              <button className="btn btn-primary" onClick={handleConfirm}>✓ Save {Object.keys(editedBiomarkers).length} Markers</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── MANUAL ENTRY MODAL ───────────────────────────────────────────────────────
function ManualEntryModal({ onClose, onSave, person }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [values, setValues] = useState({});
  const [catFilter, setCatFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSave = () => {
    const nonEmpty = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
    if (Object.keys(nonEmpty).length === 0) { alert("Please enter at least one value."); return; }
    onSave(date, nonEmpty);
  };

  const filtered = getBiomarkersForPerson(person || null).filter(b => {
    const cat = BIOMARKER_DB[b].category;
    return (catFilter === "All" || cat === catFilter) && (!searchTerm || b.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>+ Manual Entry</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>TEST DATE</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ marginTop: 6, maxWidth: 200 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 180, fontSize: 12 }} />
          {["All", ...CATEGORIES].map(c => (
            <button key={c} className={`tab-btn ${catFilter === c ? "active" : ""}`} onClick={() => setCatFilter(c)} style={{ fontSize: 10 }}>{c}</button>
          ))}
        </div>
        <div className="modal-grid-2" style={{ maxHeight: 380, overflowY: "auto", marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {filtered.map(name => {
            const b = BIOMARKER_DB[name];
            const status = values[name] ? getStatus(name, values[name]) : null;
            return (
              <div key={name} style={{ padding: "10px 12px", borderRadius: 8, background: "#060d1e", border: `1px solid ${status ? statusColor(status) + "44" : "#1a3050"}` }}>
                <div style={{ fontSize: 11, color: "#5a7a9a", marginBottom: 6 }}>{b.icon} {name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" placeholder="—" value={values[name] || ""} onChange={e => setValues(prev => ({ ...prev, [name]: e.target.value }))} style={{ textAlign: "right", flex: 1 }} />
                  <span style={{ fontSize: 10, color: "#3a5a7a", whiteSpace: "nowrap" }}>{b.unit}</span>
                </div>
                {values[name] && (
                  <div style={{ marginTop: 4 }}>
                    <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9 }}>{status?.toUpperCase()}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#3a5a7a" }}>{Object.values(values).filter(v => v).length} values entered</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Entry</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADD PERSON MODAL ─────────────────────────────────────────────────────────
function AddPersonModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", birthday: "", gender: "Male" });
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>Add Person</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>FULL NAME</label>
          <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ marginTop: 6 }} placeholder="e.g. Alex Johnson" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>DATE OF BIRTH</label>
          <input type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} style={{ marginTop: 6 }} />
          {form.birthday && (
            <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 6 }}>
              {new Date(form.birthday + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>GENDER</label>
          <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={{ marginTop: 6 }}>
            {["Male", "Female", "Other"].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => form.name && onAdd(form)}>Add Person</button>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT PERSON MODAL ────────────────────────────────────────────────────────
function EditPersonModal({ person, onClose, onSave }) {
  const [form, setForm] = useState({
    name: person.name ?? "",
    birthday: person.birthday ?? "",
    gender: person.gender ?? "Male",
  });

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) return;
    onSave({ name, birthday: form.birthday || undefined, gender: form.gender });
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>Edit Person</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>FULL NAME</label>
          <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ marginTop: 6 }} placeholder="e.g. Alex Johnson" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>DATE OF BIRTH</label>
          <input type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} style={{ marginTop: 6 }} />
          {form.birthday && (
            <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 6 }}>
              {new Date(form.birthday + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>GENDER</label>
          <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={{ marginTop: 6 }}>
            {["Male", "Female", "Other"].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── INFO MODAL ───────────────────────────────────────────────────────────────
function InfoModal({ name, onClose, latestEntry, themeColors }) {
  const b = BIOMARKER_DB[name];
  const val = latestEntry?.biomarkers?.[name];
  const status = val !== undefined ? getStatus(name, val) : null;
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
            <div style={{ fontSize: 11, color: "#3a5a7a", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.category} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
            {b.calculated && getCalculatedFrom(name).length > 0 && (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.25)" }}>
                <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>CALCULATED FROM</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#8aabcc" }}>This value is computed from the same test using: <strong>{getCalculatedFrom(name).join(", ")}</strong>.</p>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {val !== undefined && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: statusBg(status), border: `1px solid ${statusColor(status)}33`, marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{parseLabValue(val).display} {b.unit}</div>
            <div className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), marginTop: 4 }}>{status?.toUpperCase()}</div>
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>REFERENCE RANGES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {b.optimal && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)" }}>
              <span style={{ color: RANGE_COLORS.optimal, fontSize: 13 }}>✓ Optimal</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>{b.optimal[0]} – {b.optimal[1] > 999 ? "∞" : b.optimal[1]} {b.unit}</span>
            </div>}
            {b.sufficient && b.sufficient[0] > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)" }}>
              <span style={{ color: RANGE_COLORS.sufficient, fontSize: 13 }}>~ Sufficient</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>{b.sufficient[0]} – {b.sufficient[1]} {b.unit}</span>
            </div>}
            {b.high && b.high[0] < 9999 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,94,94,0.08)", border: "1px solid rgba(255,94,94,0.2)" }}>
              <span style={{ color: "#ff5e5e", fontSize: 13 }}>↑ High Risk</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>≥{b.high[0]} {b.unit}</span>
            </div>}
            {b.low && b.low[1] > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,140,66,0.08)", border: "1px solid rgba(255,140,66,0.2)" }}>
              <span style={{ color: "#ff8c42", fontSize: 13 }}>↓ Low Risk</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>≤{b.low[1]} {b.unit}</span>
            </div>}
          </div>
        </div>
        {b.monitorFrequency && MONITOR_FREQUENCY_LABELS[b.monitorFrequency] && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>MONITORING (Blueprint Biomarkers)</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>Suggested retest: <strong>{MONITOR_FREQUENCY_LABELS[b.monitorFrequency]}</strong>. Based on <a href="https://blueprintbiomarkers.com" target="_blank" rel="noopener noreferrer" style={{ color: "#0ef" }}>blueprintbiomarkers.com</a> (2×/year panels).</p>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>ABOUT</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.description}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: RANGE_COLORS.optimal, letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>HOW TO IMPROVE</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.improve}</p>
        </div>
        <button className="btn btn-secondary" onClick={onClose} style={{ width: "100%" }}>Close</button>
      </div>
    </div>
  );
}

// ─── VIEW ORIGINAL IMPORTED FILE MODAL ────────────────────────────────────────
function ViewOriginalModal({ file, onClose, themeColors }) {
  const { mimeType, data } = file || {};
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType && mimeType.startsWith("image/");
  const dataUrl = data ? `data:${mimeType || "image/jpeg"};base64,${data}` : null;

  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    if (!isPdf || !data) return;
    try {
      const binary = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const blob = new Blob([binary], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch (_) {
      setBlobUrl(null);
    }
  }, [isPdf, data]);

  if (!data && !blobUrl) return null;

  const tc = themeColors || {};
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: isPdf ? "90vw" : 800, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${tc.border || "#1a3050"}` }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#ddf" }}>Original imported file</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }} aria-label="Close">✕</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", justifyContent: "center", alignItems: "flex-start", minHeight: 0 }}>
          {isImage && dataUrl && <img src={dataUrl} alt="Imported document" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />}
          {isPdf && blobUrl && <iframe src={blobUrl} title="Imported PDF" style={{ width: "100%", minHeight: "75vh", border: "none" }} />}
          {isPdf && !blobUrl && <div style={{ color: tc.textDim || "#5a7a9a", fontSize: 14 }}>Loading PDF…</div>}
          {!isPdf && !isImage && dataUrl && <img src={dataUrl} alt="Imported document" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />}
        </div>
      </div>
    </div>
  );
}

// ─── EXPORT PDF MODAL ────────────────────────────────────────────────────────
function ExportModal({ onClose, person, personEntries, cumulativeSnapshot, getBirthdayDisplay, getAge }) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const reportRef = useRef();

  const statusLabel = (s) => ({ optimal: "Optimal", sufficient: "Sufficient", elite: "Elite", high: "High", low: "Low", "out-of-range": "Out of Range", unknown: "–" }[s] || "–");
  const statusHex  = (s) => RANGE_COLORS[s] || RANGE_COLORS.unknown;

  // Build sorted list of all measured biomarkers from cumulative snapshot
  const categories = [...new Set(Object.values(BIOMARKER_DB).map(b => b.category))];
  const rows = [];
  categories.forEach(cat => {
    Object.entries(BIOMARKER_DB).forEach(([name, b]) => {
      if (b.category !== cat) return;
      const snap = cumulativeSnapshot[name];
      if (!snap) return;
      const allPoints = personEntries
        .filter(e => e.biomarkers?.[name] !== undefined)
        .map(e => {
          const p = parseLabValue(e.biomarkers[name]);
          return { date: e.date, val: p.numeric };
        })
        .filter(p => !Number.isNaN(p.val));
      const status = getStatus(name, snap.val);
      rows.push({ cat, name, b, snap, status, allPoints });
    });
  });

  // Group by category for the PDF table
  const grouped = {};
  rows.forEach(r => { (grouped[r.cat] = grouped[r.cat] || []).push(r); });

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Dynamically load jsPDF from CDN
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const PAGE_W = 210, PAGE_H = 297, M = 14;
      const CONTENT_W = PAGE_W - M * 2;
      const COL = { name: 58, val: 22, unit: 22, status: 24, optimal: 40, trend: CONTENT_W - 58 - 22 - 22 - 24 - 40 };

      const drawHeader = (pageNum) => {
        // Background header bar
        doc.setFillColor(5, 10, 20);
        doc.rect(0, 0, PAGE_W, 22, "F");
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 238, 255);
        doc.text("BIOTRACKER BIOMARKER REPORT", M, 13);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.setTextColor(90, 120, 150);
        const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
        doc.text(`Generated ${dateStr}  ·  Page ${pageNum}`, PAGE_W - M, 13, { align: "right" });
      };

      // ── Page 1: Cover + Summary ─────────────────────────────────────────────
      drawHeader(1);
      let y = 32;

      // Person info block
      doc.setFillColor(10, 22, 40);
      doc.roundedRect(M, y, CONTENT_W, 26, 3, 3, "F");
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(200, 216, 240);
      doc.text(person?.name || "Unknown", M + 6, y + 10);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(90, 120, 150);
      const bio = [
        getBirthdayDisplay(person) ? `Born ${getBirthdayDisplay(person)}${getAge(person) ? ` · Age ${getAge(person)}` : ""}` : null,
        person?.gender,
        `${personEntries.length} test entries`
      ].filter(Boolean).join("  ·  ");
      doc.text(bio, M + 6, y + 18);
      y += 34;

      // Status summary boxes
      const statusSummary = { optimal: 0, sufficient: 0, elite: 0, high: 0, low: 0, total: 0 };
      rows.forEach(r => {
        const s = r.status;
        if (s === "optimal") statusSummary.optimal++;
        else if (s === "sufficient") statusSummary.sufficient++;
        else if (s === "elite") statusSummary.elite++;
        else if (s === "high" || s === "out-of-range") statusSummary.high++;
        else if (s === "low") statusSummary.low++;
        statusSummary.total++;
      });

      const boxes = [
        { label: "Optimal", count: statusSummary.optimal, color: RANGE_RGB.optimal },
        { label: "Sufficient", count: statusSummary.sufficient, color: RANGE_RGB.sufficient },
        { label: "Elite", count: statusSummary.elite, color: RANGE_RGB.elite },
        { label: "High", count: statusSummary.high, color: RANGE_RGB.high },
        { label: "Low", count: statusSummary.low, color: RANGE_RGB.low },
      ];
      const bw = CONTENT_W / boxes.length - 3;
      boxes.forEach((box, i) => {
        const bx = M + i * (bw + 3.75);
        doc.setFillColor(10, 22, 40); doc.roundedRect(bx, y, bw, 20, 2, 2, "F");
        doc.setDrawColor(...box.color); doc.setLineWidth(0.4);
        doc.roundedRect(bx, y, bw, 20, 2, 2, "S");
        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(...box.color);
        doc.text(String(box.count), bx + bw / 2, y + 12, { align: "center" });
        doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(74, 106, 138);
        doc.text(box.label.toUpperCase(), bx + bw / 2, y + 18, { align: "center" });
      });
      y += 28;

      // ── Table ───────────────────────────────────────────────────────────────
      // Column header row
      const drawTableHeader = (yy) => {
        doc.setFillColor(15, 30, 55); doc.rect(M, yy, CONTENT_W, 7, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(74, 106, 138);
        let cx = M + 2;
        [["BIOMARKER", COL.name], ["VALUE", COL.val], ["UNIT", COL.unit], ["STATUS", COL.status], ["OPTIMAL RANGE", COL.optimal], ["TREND", COL.trend]].forEach(([label, w]) => {
          doc.text(label, cx, yy + 5); cx += w;
        });
        return yy + 7;
      };

      y = drawTableHeader(y);

      let pageNum = 1;
      const newPage = () => {
        doc.addPage();
        pageNum++;
        drawHeader(pageNum);
        y = 28;
        y = drawTableHeader(y);
      };

      let lastCat = null;
      rows.forEach((row) => {
        const ROW_H = 8;
        const CAT_H = 9;

        if (y + ROW_H + (row.cat !== lastCat ? CAT_H : 0) > PAGE_H - 16) newPage();

        // Category section header
        if (row.cat !== lastCat) {
          lastCat = row.cat;
          doc.setFillColor(8, 18, 35); doc.rect(M, y, CONTENT_W, CAT_H - 1, "F");
          doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 180, 200);
          doc.text(row.cat.toUpperCase(), M + 3, y + 5.5);
          y += CAT_H;
        }

        // Row background (alternating)
        const rowIdx = rows.indexOf(row);
        doc.setFillColor(rowIdx % 2 === 0 ? 10 : 13, rowIdx % 2 === 0 ? 22 : 26, rowIdx % 2 === 0 ? 40 : 48);
        doc.rect(M, y, CONTENT_W, ROW_H, "F");

        // Status left accent bar
        const [sr, sg, sb] = (() => {
          const hex = statusHex(row.status);
          const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b_ = parseInt(hex.slice(5, 7), 16);
          return [r, g, b_];
        })();
        doc.setFillColor(sr, sg, sb); doc.rect(M, y, 1.5, ROW_H, "F");

        const textY = y + 5.5;
        let cx = M + 3;

        // Biomarker name
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 200, 220);
        doc.text(row.name, cx, textY, { maxWidth: COL.name - 3 }); cx += COL.name;

        // Value (colored) — use display form for < / > results
        doc.setFont("helvetica", "bold"); doc.setTextColor(sr, sg, sb);
        doc.text(parseLabValue(row.snap.val).display, cx, textY, { maxWidth: COL.val - 2 }); cx += COL.val;

        // Unit
        doc.setFont("helvetica", "normal"); doc.setTextColor(74, 106, 138);
        doc.text(row.b.unit, cx, textY, { maxWidth: COL.unit - 2 }); cx += COL.unit;

        // Status pill text
        doc.setFont("helvetica", "bold"); doc.setTextColor(sr, sg, sb);
        doc.text(statusLabel(row.status), cx, textY, { maxWidth: COL.status - 2 }); cx += COL.status;

        // Optimal range
        doc.setFont("helvetica", "normal"); doc.setTextColor(0, 180, 130);
        const optStr = `${row.b.optimal[0]}–${row.b.optimal[1] > 900 ? "∞" : row.b.optimal[1]}`;
        doc.text(optStr, cx, textY, { maxWidth: COL.optimal - 2 }); cx += COL.optimal;

        // Inline sparkline trend from allPoints
        if (row.allPoints.length >= 2) {
          const pts = row.allPoints;
          const vals = pts.map(p => p.val);
          const minV = Math.min(...vals), maxV = Math.max(...vals);
          const span = maxV - minV || 1;
          const sw = COL.trend - 6, sh = 5;
          const sx = cx + 1, sy = y + 1.5;
          // draw sparkline path
          doc.setDrawColor(sr, sg, sb); doc.setLineWidth(0.5);
          for (let i = 0; i < pts.length - 1; i++) {
            const x1 = sx + (i / (pts.length - 1)) * sw;
            const x2 = sx + ((i + 1) / (pts.length - 1)) * sw;
            const y1 = sy + sh - ((vals[i] - minV) / span) * sh;
            const y2 = sy + sh - ((vals[i + 1] - minV) / span) * sh;
            doc.line(x1, y1, x2, y2);
          }
          // endpoint dot
          const lastX = sx + sw, lastY = sy + sh - ((vals[vals.length - 1] - minV) / span) * sh;
          doc.setFillColor(sr, sg, sb); doc.circle(lastX, lastY, 0.8, "F");
          // trend arrow
          const arrow = vals[vals.length - 1] > vals[vals.length - 2] ? "↗" : vals[vals.length - 1] < vals[vals.length - 2] ? "↘" : "→";
          doc.setFontSize(7); doc.text(arrow, cx + COL.trend - 5, textY);
        } else if (row.allPoints.length === 1) {
          doc.setFontSize(7); doc.setTextColor(74, 106, 138);
          doc.text("1 point", cx + 1, textY);
        }

        y += ROW_H;
      });

      // Footer on last page
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 65, 90);
      doc.text("Biotracker  ·  Reference ranges based on ACSM, Endocrine Society, ACC/AHA, and WHOOP guidelines.", M, PAGE_H - 8);

      doc.save(`Biotracker_${(person?.name || "Report").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
      setDone(true);
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>⬇ Export PDF Report</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {/* Preview summary */}
        <div style={{ padding: "16px 20px", borderRadius: 10, background: "#060d1e", border: "1px solid #1a3050", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c8d8f0", marginBottom: 6, fontFamily: "Space Grotesk, sans-serif" }}>{person?.name}</div>
          <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 12 }}>
            {getBirthdayDisplay(person) && <span>Born {getBirthdayDisplay(person)} · </span>}
            {personEntries.length} test entries · {rows.length} biomarkers tracked
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="stat-pill" style={{ background: "#0a1628", border: "1px solid #1a3050", color: "#6a8aaa", fontSize: 10 }}>
                {cat} ({items.length})
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 20, lineHeight: 1.7 }}>
          The PDF will include:<br />
          • Cover page with your personal stats summary<br />
          • Full biomarker table sorted by category<br />
          • Latest value, unit, status, and optimal range for each marker<br />
          • Inline sparkline trend for each biomarker with multiple readings<br />
          • Color-coded status indicators (Optimal, Sufficient, Elite, High, Low)
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, color: RANGE_COLORS.optimal }}>PDF downloaded successfully!</div>
            <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 16 }}>Close</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={generatePDF}
              disabled={generating || rows.length === 0}
              style={{ opacity: generating || rows.length === 0 ? 0.6 : 1 }}
            >
              {generating ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #050a14", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                  Generating…
                </>
              ) : `⬇ Download PDF (${rows.length} markers)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
