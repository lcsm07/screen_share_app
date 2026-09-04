/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure comma-separated LAN origins only when developing from another device.
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

module.exports = nextConfig;
