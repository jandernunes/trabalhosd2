/** @type {import('next').NextConfig} */
const nextConfig = {
  // protobufjs roda no Node como está (sem passar pelo bundler), só nos Route Handlers.
  serverExternalPackages: ["protobufjs"],
};

export default nextConfig;
