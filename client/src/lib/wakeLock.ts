import { useEffect, useState } from 'react';

export type WakeLockStatus = 'off' | 'on' | 'unsupported' | 'failed';

/**
 * Keeps the device screen on while `active`, using the Screen Wake Lock API.
 * The browser drops the lock whenever the tab is hidden, so it is re-acquired when the tab
 * becomes visible again. Only available on HTTPS pages (and localhost).
 */
export function useWakeLock(active: boolean): WakeLockStatus {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext;
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'off' : 'unsupported');

  useEffect(() => {
    if (!supported || !active) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) return void lock.release();
        setStatus('on');
        lock.addEventListener('release', () => !cancelled && setStatus('off'));
      } catch {
        // For example, battery saver mode on some phones refuses the lock.
        if (!cancelled) setStatus('failed');
      }
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
      setStatus('off');
    };
  }, [active, supported]);

  return status;
}
