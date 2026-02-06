/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@loe/ui', '@loe/core'],
  // Warning "preloaded using link preload but not used" (layout.css) : connu avec
  // Next.js — le preload des chunks CSS est géré par le framework. Inoffensif.
  // Pour le supprimer en prod : experimental: { inlineCss: true }
};

module.exports = nextConfig;
