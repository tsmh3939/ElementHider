import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import { readFileSync } from "fs";
import { relative } from "path";
import { APP_NAME, APP_VERSION } from "./src/shared/config";

const baseManifest = JSON.parse(readFileSync("./manifest.json", "utf-8"));

const PAGE_TITLES: Record<string, string> = {
  "src/popup/index.html":  APP_NAME,
  "src/options/index.html": `${APP_NAME} - 設定`,
};

function pageTitlePlugin(): Plugin {
  return {
    name: "page-title",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const rel = relative(process.cwd(), ctx.filename).replace(/\\/g, "/");
        const title = PAGE_TITLES[rel] ?? "ElementHider";
        return html.replace("%PAGE_TITLE%", title);
      },
    },
  };
}

export default defineConfig({
  plugins: [
    pageTitlePlugin(),
    react(),
    webExtension({
      manifest: () => ({ ...baseManifest, name: APP_NAME, version: APP_VERSION }),
      additionalInputs: ["src/content/picker.css"],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
