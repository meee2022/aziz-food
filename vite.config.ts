import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// معرّف البناء: يُحقن في الكود (__BUILD_ID__) ويُكتب في /version.json ليكتشف
// التطبيق المفتوح وجود نسخة أحدث ويعيد تحميل نفسه (انظر src/lib/autoUpdate.ts).
const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

function versionFile(): Plugin {
  return {
    name: "version-json",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: {
    host: true,
    port: 5173,
  },
});
