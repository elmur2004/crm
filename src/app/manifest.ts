import type { MetadataRoute } from "next";

/* ADR-060 (founder 4.2) — the installable app's identity: name, colors and
   the OFFICIAL B-Systems mark, so a home-screen install shows the real logo
   instead of a coloured square. Served at /manifest.webmanifest and linked
   from every page (a root metadata file needs no root layout — verified on
   the built app; ADR-007's per-group <html> stamping is untouched).

   Asset exemption (SPEC §4.4 precedent): a web app manifest cannot consume
   CSS variables; these literals mirror branding/b-systems/tokens.css exactly
   (#1D267D = --bs-indigo; #FFFFFF = the icons' solid plate — iOS composites
   transparency onto BLACK, so the plate is baked into the PNGs too). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B-Systems",
    short_name: "B-Systems",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1D267D",
    icons: [
      { src: "/brand/b-systems/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/b-systems/app-icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/b-systems/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
