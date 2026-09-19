/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          has: [{ type: "host", value: "smart.breadman.studio" }],
          destination: "/panel/:path*",
        },
        {
          source: "/",
          has: [{ type: "host", value: "smart.breadman.studio" }],
          destination: "/panel",
        },
      ],
    };
  },
};

export default nextConfig;
