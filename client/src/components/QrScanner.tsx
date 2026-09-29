import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface Props {
  onCode: (roomCode: string) => void;
  onClose: () => void;
}

/** Pulls a room code out of a scanned QR: either a ".../room/ABC123" link or a bare code. */
export function roomCodeFrom(text: string): string | null {
  const fromLink = /\/room\/([A-Za-z0-9]{6})(?:[/?#]|$)/.exec(text);
  if (fromLink) return fromLink[1].toUpperCase();
  const bare = text.trim();
  return /^[A-Za-z0-9]{6}$/.test(bare) ? bare.toUpperCase() : null;
}

export default function QrScanner({ onCode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('Point your camera at the QR code on the karaoke screen.');

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('The camera only works on an HTTPS link. Type the room code instead.');
      return;
    }
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const scan = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= video.HAVE_ENOUGH_DATA) {
        // Downscale for speed; QR codes decode fine at this size.
        const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (result) {
          const code = roomCodeFrom(result.data);
          if (code) {
            stopped = true;
            navigator.vibrate?.(80);
            onCode(code);
            return;
          }
          setHint('That QR code isn’t a karaoke room. Try the one on the karaoke screen.');
        }
      }
      frame = requestAnimationFrame(scan);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        video.play().catch(() => {});
        frame = requestAnimationFrame(scan);
      })
      .catch((err: DOMException) => {
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, or type the room code.'
            : err.name === 'NotFoundError'
              ? 'No camera found on this device. Type the room code instead.'
              : 'Couldn’t open the camera. Type the room code instead.',
        );
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="scanner-backdrop" onClick={onClose}>
      <div className="scanner card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Scan room QR code">
        <h2>Scan room QR code</h2>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            <div className="scanner-view">
              <video ref={videoRef} playsInline muted />
              <div className="scanner-frame" />
            </div>
            <p className="muted small">{hint}</p>
          </>
        )}
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
