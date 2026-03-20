import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = (
    env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
  const anthropicKey = (
    env.VITE_ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    ""
  ).trim();
  const openaiKey = (
    env.VITE_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();
  const groqKey = (
    env.VITE_GROQ_API_KEY ||
    process.env.GROQ_API_KEY ||
    ""
  ).trim();

  return {
    // Relative asset URLs so the app loads on GitHub Pages whether the site is at domain root
    // (user.github.io) or a project subpath (user.github.io/repo/). Absolute "/assets/..." breaks the latter.
    base: "./",
    plugins: [react()],
    server: {
      host: true, // listen on 0.0.0.0 so LAN devices can access (e.g. http://<your-ip>:5173)
      proxy: {
        "/api/gemini": {
          target: "https://generativelanguage.googleapis.com",
          changeOrigin: true,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/api\/gemini/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const raw = req.headers["x-goog-api-key"] || req.headers["X-Goog-Api-Key"];
              const fromClient = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
              const final = fromClient || apiKey;
              if (final) proxyReq.setHeader("x-goog-api-key", final);
            });
          },
        },
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          proxyTimeout: 480000,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, "/v1/messages"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const raw = req.headers["x-api-key"] || req.headers["X-Api-Key"];
              const fromClient = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
              const final = fromClient || anthropicKey;
              if (final) proxyReq.setHeader("x-api-key", final);
              proxyReq.setHeader("anthropic-version", "2023-06-01");
            });
          },
        },
        "/api/openai": {
          target: "https://api.openai.com",
          changeOrigin: true,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/api\/openai/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const raw = req.headers.authorization || req.headers.Authorization;
              const fromClient = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
              if (fromClient) {
                proxyReq.setHeader("Authorization", fromClient.startsWith("Bearer ") ? fromClient : `Bearer ${fromClient}`);
              } else if (openaiKey) {
                proxyReq.setHeader("Authorization", `Bearer ${openaiKey}`);
              }
            });
          },
        },
        "/api/groq": {
          target: "https://api.groq.com",
          changeOrigin: true,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/api\/groq/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const raw = req.headers.authorization || req.headers.Authorization;
              const fromClient = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
              if (fromClient) {
                proxyReq.setHeader("Authorization", fromClient.startsWith("Bearer ") ? fromClient : `Bearer ${fromClient}`);
              } else if (groqKey) {
                proxyReq.setHeader("Authorization", `Bearer ${groqKey}`);
              }
            });
          },
        },
        "/api/ollama": {
          target: "http://localhost:11434",
          changeOrigin: true,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ""),
        },
        "/api/whoop": {
          target: "https://api.prod.whoop.com",
          changeOrigin: true,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/api\/whoop/, ""),
        },
      },
    },
  };
});
