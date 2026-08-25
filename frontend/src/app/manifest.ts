import type { MetadataRoute } from "next";


export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DLL347",
    short_name: "DLL347",
    description: "Datu Lapu-Lapu Lodge No. 347 progressive web application.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#faf6f0",
    theme_color: "#faf6f0",
    icons: [
      {
        src: "/branding/dll347-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/dll347-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/dll347-icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/branding/dll347-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
