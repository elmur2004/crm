import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ADR-065 — the ONE file that must never be cached.

     `public/sw.js` is the push service worker. It is served from the origin
     root so it gets scope over every route, and this app sits behind
     Cloudflare, which caches `.js` by extension unless the origin says
     otherwise. A stale service worker at an edge is a bug that outlives the
     deploy that fixed it, so the origin says otherwise. `updateViaCache: "none"`
     at registration covers the browser's own HTTP cache; this covers the proxy
     in front of it. Scoped to this one path — no other route's headers change. */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
