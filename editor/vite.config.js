import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Everything is inlined into dist/index.html so the editor opens straight from disk (file://).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // The domain module imports ../story-map.schema.json from the repository root.
  server: { fs: { allow: [".."] } },
  test: {
    environment: "node",
  },
});
