/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ["exceljs"] },
  eslint: { ignoreDuringBuilds: true },
};
