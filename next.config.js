/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permit browser development from a LAN address. Configure a comma-separated
  // list in DEV_ALLOWED_ORIGINS when the machine's address is not this default.
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "192.168.15.187")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // livekit-client e componentes precisam rodar só no cliente
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
