/**
 * Google Drive appDataFolder client. Uses Drive API v3 with scope drive.appdata.
 * All data (people, entries, API keys) is stored in a single JSON file.
 */

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const DATA_FILE_NAME = "biotracker-data.json";

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/**
 * List files in appDataFolder. Returns items with id and name.
 * @param {string} accessToken
 * @returns {Promise<{ id: string, name: string }[]>}
 */
export async function listAppDataFiles(accessToken) {
  const url = `${DRIVE_API_BASE}/files?spaces=appDataFolder&fields=files(id,name)&q=trashed%3Dfalse`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? "Token expired or invalid" : `Drive list failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * Find the app data file by name, or return null.
 * @param {string} accessToken
 * @returns {Promise<{ id: string, name: string } | null>}
 */
export async function findDataFile(accessToken) {
  const files = await listAppDataFiles(accessToken);
  return files.find((f) => f.name === DATA_FILE_NAME) || null;
}

/**
 * Create a new file in appDataFolder with initial content.
 * @param {string} accessToken
 * @param {object} payload { people, entries, settings }
 * @returns {Promise<{ id: string }>}
 */
export async function createDataFile(accessToken, payload) {
  const metadata = {
    name: DATA_FILE_NAME,
    mimeType: "application/json",
    parents: ["appDataFolder"],
  };
  const boundary = "biotracker_boundary_" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(payload) +
    `\r\n--${boundary}--\r\n`;

  const res = await fetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? "Token expired or invalid" : `Drive create failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return { id: data.id };
}

/**
 * Read file content from Drive.
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<object>} Parsed JSON payload
 */
export async function readDataFile(accessToken, fileId) {
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? "Token expired or invalid" : `Drive read failed: ${res.status} ${err}`);
  }
  const text = await res.text();
  if (!text.trim()) return { people: [], entries: {}, settings: {} };
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON in Drive file");
  }
}

/**
 * Update an existing file's content (full replace).
 * @param {string} accessToken
 * @param {string} fileId
 * @param {object} payload { people, entries, settings }
 */
export async function updateDataFile(accessToken, fileId, payload) {
  const boundary = "biotracker_boundary_" + Math.random().toString(36).slice(2);
  const metadata = { mimeType: "application/json" };
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(payload) +
    `\r\n--${boundary}--\r\n`;

  const res = await fetch(`${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=multipart`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? "Token expired or invalid" : `Drive update failed: ${res.status} ${err}`);
  }
}

/**
 * Get or create the app data file; returns { fileId, data } where data is { people, entries, settings }.
 * @param {string} accessToken
 * @returns {Promise<{ fileId: string, data: { people: any[], entries: object, settings: object } }>}
 */
export async function getOrCreateAppData(accessToken) {
  const existing = await findDataFile(accessToken);
  if (existing) {
    const data = await readDataFile(accessToken, existing.id);
    return {
      fileId: existing.id,
      data: {
        people: Array.isArray(data.people) ? data.people : [],
        entries: data.entries && typeof data.entries === "object" ? data.entries : {},
        settings: data.settings && typeof data.settings === "object" ? data.settings : {},
      },
    };
  }
  const payload = { people: [], entries: {}, settings: {} };
  const { id } = await createDataFile(accessToken, payload);
  return { fileId: id, data: payload };
}
