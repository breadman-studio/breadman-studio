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
        // smart.breadman.studio muestra el panel
        {
          source: "/",
          has: [{ type: "host", value: "smart.breadman.studio" }],
          destination: "/panel",
        },
        // El resto de las rutas del subdominio van a /panel, EXCEPTO:
        // _next (archivos JavaScript y CSS), api (login, logout) y panel (ya es del panel).
        // Antes se redirigia todo, y el JavaScript no cargaba: los botones no funcionaban.
        {
          source: "/:path((?!_next|api|panel|favicon).*)",
          has: [{ type: "host", value: "smart.breadman.studio" }],
          destination: "/panel/:path",
        },
      ],
    };
  },
};

export default nextConfig;
