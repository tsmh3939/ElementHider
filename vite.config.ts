import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import { readFileSync } from "fs";
import { APP_NAME, APP_VERSION } from "./src/shared/config";

const baseManifest = JSON.parse(readFileSync("./manifest.json", "utf-8"));

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: () => ({
        ...baseManifest,
        name: APP_NAME,
        version: APP_VERSION,
        commands: {
          ...baseManifest.commands,
          _execute_action: {
            ...baseManifest.commands._execute_action,
            description: `${APP_NAME}を開く`,
          },
        },
      }),
      additionalInputs: [
        "src/content/early-inject.ts",
        "src/content/content.tsx",
        "src/content/picker.css",
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
