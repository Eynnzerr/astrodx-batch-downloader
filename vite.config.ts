import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 1421,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("node_modules/@tauri-apps")) {
            return "vendor-tauri";
          }

          if (
            id.includes("node_modules/antd") ||
            id.includes("node_modules/@ant-design") ||
            id.includes("node_modules/rc-") ||
            id.includes("node_modules/@rc-component")
          ) {
            return "vendor-antd";
          }

          return undefined;
        },
      },
    },
  },
});
