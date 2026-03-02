import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  images: {
    unoptimized: true, // Cloudinary handles optimization — bypass Vercel's /_next/image proxy (402 quota limit)
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ijchxbtovluwlrdbwrqb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  // NOTE: Do NOT use removeConsole in production — it silently strips all
  // console.log / console.error, making it impossible to debug email, webhook,
  // and Shiprocket issues on Vercel.  Logs are visible in Vercel → Deployments → Function Logs.
  // compiler: {
  //   removeConsole: process.env.NODE_ENV === "production",
  // },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/supabase/:path*",
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/:path*`, // Proxy to Supabase
      },
    ];
  },
};

export default nextConfig;
