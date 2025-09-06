// ============================================
// 1. UPDATE next.config.js - ADD THE MAIN ALIAS
// ============================================

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
      },
      {
        protocol: 'https',
        hostname: 'icons.duckduckgo.com',
      },
      {
        protocol: 'https',
        hostname: 'linktree.sirv.com',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/components': path.resolve(__dirname, 'app/components'),
      '@/important': path.resolve(__dirname, 'important'),
      '@/forget-password-pages': path.resolve(__dirname, 'app/(forget password pages)'),
      '@/forget-password': path.resolve(__dirname, 'app/forget-password/forgot-password'),
      '@/dashboard': path.resolve(__dirname, 'app/dashboard'),
      '@/elements': path.resolve(__dirname, 'app/elements'),
      '@/hooks': path.resolve(__dirname, 'hooks'),
      '@/LocalHooks': path.resolve(__dirname, 'LocalHooks'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/contexts': path.resolve(__dirname, 'contexts'),
      '@/utils': path.resolve(__dirname, 'utils'),
      '@/login': path.resolve(__dirname, 'app/login'),
      '@/signup': path.resolve(__dirname, 'app/signup'),
      '@/styles': path.resolve(__dirname, 'styles'),
      '@/user': path.resolve(__dirname, 'app/[userId]'),
      '@/locales': path.resolve(__dirname, 'public/locales'),
      '@/app': path.resolve(__dirname, 'app'),
      
      // ✅ ADD THE MAIN ALIAS HERE - THIS WAS MISSING!
      '@serviceEnterprise': path.resolve(__dirname, 'lib/services/serviceEnterprise'),
      '@serviceEnterprise/server': path.resolve(__dirname, 'lib/services/serviceEnterprise/server'),
      '@serviceEnterprise/client': path.resolve(__dirname, 'lib/services/serviceEnterprise/client'),
    };
    return config;
  },
};

module.exports = nextConfig;
