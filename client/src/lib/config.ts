/**
 * Where the karaoke server lives. Empty means "same site as these pages" (local dev through the
 * Vite proxy, or the server serving the built pages). Set VITE_SERVER_URL when the pages are
 * hosted separately, e.g. on Vercel: VITE_SERVER_URL=https://czkaraoke-server.onrender.com
 */
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');

export const apiUrl = (path: string) => `${SERVER_URL}${path}`;
