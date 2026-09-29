/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Karaoke server URL when the pages are hosted separately (e.g. on Vercel). */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
