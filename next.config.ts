import type { NextConfig } from "next";

const NICEONE_ORIGIN = "https://niceonesa.com";
const NICEONE_CDN = "https://cdn.niceonesa.com";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/_ipx/:path*",
          destination: `${NICEONE_ORIGIN}/_ipx/:path*`,
        },
        {
          source: "/web/:path*",
          destination: `${NICEONE_CDN}/web/:path*`,
        },
        {
          source: "/_nuxt/:path*",
          destination: `${NICEONE_CDN}/web/assets_v2/_nuxt/:path*`,
        },
        {
          source: "/image/:path*",
          destination: `${NICEONE_ORIGIN}/image/:path*`,
        },
        {
          source: "/images/:path*",
          destination: `${NICEONE_CDN}/web/assets_v2/images/:path*`,
        },
        {
          source: "/api/:path*",
          destination: `${NICEONE_ORIGIN}/api/:path*`,
        },
        {
          source: "/manifest.webmanifest",
          destination: `${NICEONE_ORIGIN}/manifest.webmanifest`,
        },
      ],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        // Apply CORS headers to logo files
        source: "/lk-logo.svg",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
        ],
      },
      {
        // Apply CORS headers to dark logo file
        source: "/lk-logo-dark.svg",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "GET, OPTIONS",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
