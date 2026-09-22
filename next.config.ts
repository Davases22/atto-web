import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The client's landing page is served as designed, from public/home.
  // The old React home is untouched and answers at /classic: this hides
  // it, it deletes nothing. Drop the rewrite to put it back at the root.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/home/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
