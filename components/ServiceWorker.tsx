'use client';

import { useEffect } from 'react';

/**
 * Registers the app-shell service worker after load. Registration is
 * best-effort — the app works identically without it; the worker only buys an
 * instant, offline-tolerant launch once installed to the home screen.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore — a failed registration must never break the page.
      });
    };
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
