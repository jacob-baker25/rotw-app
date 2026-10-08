/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the local dev server's generated files separate from production builds.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
