import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GY Company OS",
    short_name: "GY",
    description: "Create better. Grow with clarity. Company OS.",
    start_url: "/admin",
    display: "standalone",
    background_color: "#07111f",
    theme_color: "#4f46e5",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
