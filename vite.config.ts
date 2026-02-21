import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import { readFileSync } from "fs";
import { APP_VERSION } from "./src/shared/config";

const baseManifest = JSON.parse(readFileSync("./manifest.json", "utf-8"));

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: () => ({ ...baseManifest, version: APP_VERSION }),
      additionalInputs: ["src/content/picker.css"],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
