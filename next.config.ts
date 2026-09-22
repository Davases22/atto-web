import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The client's new landing page is served as it was designed, from
  // public/home. The old React home is untouched and still reachable at
  // /classic: this only hides it, it deletes nothing. Drop the rewrite to
  // put the old one back at the root.
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
