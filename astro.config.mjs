// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

const site = process.env.SITE_URL ?? "http://localhost:4321";

export default defineConfig({
  integrations: [react()],
  site,
  trailingSlash: "never",
  // Astro dev server does not process public/_headers; Giscus loads custom
  // themes as anonymous cross-origin stylesheets and therefore needs CORS.
  vite: {
    server: {
      cors: {
        origin: "*",
        credentials: false
      },
      allowedHosts: ["individuals-wants-attention-retailers.trycloudflare.com"],
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    }
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark"
      }
    }
  }
});
