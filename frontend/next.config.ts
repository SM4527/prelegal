import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML in out/, served by the FastAPI backend. trailingSlash emits
  // route/index.html so /signin/ resolves without custom routing.
  output: "export",
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
