import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Everything is inlined into dist/index.html so the editor opens straight from disk (file://).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Files imported from the repository root: the schema (domain module) and the sample
  // (startingPoints.js).
  server: { fs: { allow: [".."] } },
  test: {
    environment: "node",
  },
});
