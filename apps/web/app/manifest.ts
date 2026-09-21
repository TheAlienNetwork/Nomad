import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HUNT//OS",
    short_name: "HUNTOS",
    description: "Hunting Intelligence. Anywhere.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070b08",
    theme_color: "#070b08",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
