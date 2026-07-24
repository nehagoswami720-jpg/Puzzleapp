import type { MetadataRoute } from 'next';

/**
 * Served at /manifest.webmanifest (§18). `display: "standalone"` is what makes
 * an installed launch chromeless; the two colours theme the OS shell and the
 * splash. Icons are the PNGs generated from public/icon.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skill Puzzles',
    short_name: 'Skill Puzzles',
    description:
      'Type a skill you want to improve and get tailored, verified puzzles to practise it.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eef2f7',
    theme_color: '#6366f1',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
