/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const PUBLIC_SHELL = [
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Lists the built app shell for the service worker and stamps sw.js with a build version
function precacheManifest(): Plugin {
  let version = "dev";
  let outDir = "dist";
  return {
    name: "mle-precache-manifest",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_, bundle) {
      // Older font formats are skipped; every browser that runs service workers reads woff2
      const files = Object.keys(bundle)
        .filter((name) => !/\.(map|woff|ttf|eot)$/.test(name))
        .map((name) => `/${name}`)
        .sort();
      const hash = createHash("sha256");
      for (const name of files) {
        const item = bundle[name.slice(1)];
        hash.update(name);
        if (item.type === "asset") hash.update(item.source);
      }
      version = hash.digest("hex").slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "precache-manifest.json",
        source: JSON.stringify({ version, files: [...files, ...PUBLIC_SHELL] }, null, 2),
      });
    },
    writeBundle() {
      const sw = join(path("."), outDir, "sw.js");
      if (!existsSync(sw)) {
        this.warn("public/sw.js was not copied; offline support is disabled");
        return;
      }
      writeFileSync(sw, readFileSync(sw, "utf8").replace("__BUILD_VERSION__", version));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheManifest()],
  resolve: {
    alias: { "@": path("./src"), "@shared": path("../shared") },
  },
  server: {
    fs: { allow: [".."] },
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? "8000"}` },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
