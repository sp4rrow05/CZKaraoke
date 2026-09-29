import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

// Safari still uses webkit-prefixed names.
type FsDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const fsElement = () => document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;

/**
 * Fullscreen for an element. Uses the Fullscreen API where available and falls back to
 * filling the browser window (iPhone Safari only allows fullscreen for <video> elements).
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    const sync = () => setNative(!!fsElement() && fsElement() === ref.current);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [ref]);

  const enter = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    try {
      if (!request) throw new Error('unsupported');
      await request();
      // Phones: prefer landscape while the video is fullscreen (ignored where unsupported).
      (screen.orientation as any)?.lock?.('landscape').catch(() => {});
    } catch {
      setPseudo(true);
    }
  }, [ref]);

  const exit = useCallback(() => {
    setPseudo(false);
    if (fsElement()) {
      const doc = document as FsDocument;
      (document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(doc))?.().catch(() => {});
    }
  }, []);

  const isFullscreen = native || pseudo;
  const toggle = useCallback(() => (isFullscreen ? exit() : enter()), [isFullscreen, enter, exit]);

  // Escape leaves the window-filling fallback (native fullscreen handles Escape itself).
  useEffect(() => {
    if (!pseudo) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPseudo(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudo]);

  return { isFullscreen, pseudo, toggle };
}

/** True while the pointer has been still for `ms` — used to hide controls over the video. */
export function useIdle(active: boolean, ms = 3000) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!active) return setIdle(false);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), ms);
    };
    wake();
    const events = ['mousemove', 'pointerdown', 'touchstart', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, wake));
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [active, ms]);

  return idle;
}
