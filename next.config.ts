import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Évite l'avertissement de multiple lockfiles (OneDrive / racine utilisateur)
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
