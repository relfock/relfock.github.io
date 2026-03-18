/**
 * Google Identity Services (GSI) token client for Drive API access.
 * Requires VITE_GOOGLE_CLIENT_ID. Loads https://accounts.google.com/gsi/client and requests
 * an access_token with scope drive.appdata.
 */

const GSI_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(el);
  });
}

/**
 * Request Drive access token via Google Sign-In popup.
 * @param {string} clientId VITE_GOOGLE_CLIENT_ID
 * @returns {Promise<string | null>} access_token or null if user cancelled / error
 */
export async function requestDriveToken(clientId) {
  if (!clientId || !clientId.trim()) {
    throw new Error("Google Client ID not set. Add VITE_GOOGLE_CLIENT_ID to .env");
  }
  await loadScript("https://accounts.google.com/gsi/client");
  if (typeof window.google === "undefined" || !window.google.accounts?.oauth2?.initTokenClient) {
    throw new Error("Google Identity Services not available");
  }
  return new Promise((resolve) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: GSI_SCOPE,
      callback: (response) => {
        resolve(response?.access_token ?? null);
      },
    });
    client.requestAccessToken();
  });
}
