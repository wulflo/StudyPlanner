import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // El paquete de Material Color Utilities 0.4.0 tiene imports internos sin
  // extensión; al externalizarlo en SSR, Node no los resuelve. Se inlines.
  ssr: {
    noExternal: ["@material/material-color-utilities"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    restoreMocks: true,
  },
});
