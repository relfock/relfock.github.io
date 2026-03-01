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
    plugins: [react()],
    server: {
      host: true, // listen on 0.0.0.0 so LAN devices can access (e.g. http://<your-ip>:5173)
      proxy: {
        "/api/data": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
        "/api/gemini": {
          target: "https://generativelanguage.googleapis.com",
          changeOrigin: true,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/api\/gemini/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (apiKey) proxyReq.setHeader("x-goog-api-key", apiKey);
            });
          },
        },
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          proxyTimeout: 480000,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, "/v1/messages"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (anthropicKey) proxyReq.setHeader("x-api-key", anthropicKey);
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
            proxy.on("proxyReq", (proxyReq) => {
              if (openaiKey) proxyReq.setHeader("Authorization", `Bearer ${openaiKey}`);
            });
          },
        },
        "/api/groq": {
          target: "https://api.groq.com",
          changeOrigin: true,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/api\/groq/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (groqKey) proxyReq.setHeader("Authorization", `Bearer ${groqKey}`);
            });
          },
        },
      },
    },
  };
});
