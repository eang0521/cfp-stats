import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // This app renders every page from live DB queries (ratings, schedules,
  // CFP projection) that change throughout the day. Cache Components/PPR
  // defaults to prerendering pages at build time, which doesn't fit that —
  // plain per-request dynamic rendering (via `export const dynamic`) is
  // simpler here.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // drizzle's migrator reads these files with raw fs calls at runtime, which
  // the build's file tracer can't follow statically — force them into the
  // /api/migrate function's bundle explicitly.
  outputFileTracingIncludes: {
    "/api/migrate": ["./drizzle/**/*"],
  },
};

export default nextConfig;
