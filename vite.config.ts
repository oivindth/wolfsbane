/// <reference types="vitest/config" />
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    // Vite's dep pre-bundling breaks @babylonjs/havok's WASM URL resolution.
    exclude: ["@babylonjs/havok"],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
