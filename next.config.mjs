/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["leaflet", "react-leaflet"],
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
    outputFileTracingIncludes: {
      "/api/landlord/reports/income": [
        "./node_modules/pdfkit/package.json",
        "./node_modules/pdfkit/js/standard-fonts/**/*",
      ],
    },
  },
};

export default nextConfig;
