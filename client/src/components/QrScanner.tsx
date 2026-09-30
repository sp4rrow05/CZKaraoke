import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';

export interface ScannedRoom {
  code: string;
  /** Invite key from the screen's QR link; null for a bare code (then the password is needed). */
  invite: string | null;
}

interface Props {
  onScan: (room: ScannedRoom) => void;
  onClose: () => void;
}

/** Reads the invite key from a link's "#invite=…" (or "?invite=…") part. */
export function inviteFrom(text: string): string | null {
  const match = /[#?&]invite=([A-Za-z0-9_-]+)/.exec(text);
  return match ? match[1] : null;
}

/** Parses a scanned QR: a ".../room/ABC123#invite=…" link, or a bare room code. */
export function parseRoomQr(text: string): ScannedRoom | null {
  const fromLink = /\/room\/([A-Za-z0-9]{6})(?:[/?#]|$)/.exec(text);
  if (fromLink) return { code: fromLink[1].toUpperCase(), invite: inviteFrom(text) };
  const bare = text.trim();
  return /^[A-Za-z0-9]{6}$/.test(bare) ? { code: bare.toUpperCase(), invite: null } : null;
}

const NOT_A_ROOM = 'That QR code isn’t a karaoke room. Try the one on the karaoke screen.';

const cameraSupported = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

/** Decodes a QR code from a photo or screenshot, trying a few sizes since phone photos vary a lot. */
async function decodeImageFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    for (const target of [1024, 1600, 640, longest]) {
      const scale = Math.min(1, target / longest);
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
      if (result) return result.data;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function QrScanner({ onScan, onClose }: Props) {
  // Upload also works where the camera can't (plain http, no camera, permission denied).
  const [mode, setMode] = useState<'camera' | 'upload'>(() => (cameraSupported() ? 'camera' : 'upload'));

  // Rendered on <body>: the see-through cards use backdrop-filter, which would otherwise trap this
  // full-screen overlay inside the card.
  return createPortal(
    <div className="scanner-backdrop" onClick={onClose}>
      <div className="scanner card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Scan room QR code">
        <h2>Scan room QR code</h2>
        <div className="scanner-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'camera'}
            className={mode === 'camera' ? 'active' : ''}
            onClick={() => setMode('camera')}
          >
            📷 Camera
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'upload'}
            className={mode === 'upload' ? 'active' : ''}
            onClick={() => setMode('upload')}
          >
            🖼️ Upload image
          </button>
        </div>
        {mode === 'camera' ? (
          <CameraScan onScan={onScan} onUseUpload={() => setMode('upload')} />
        ) : (
          <UploadScan onScan={onScan} />
        )}
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}

function CameraScan({ onScan, onUseUpload }: { onScan: Props['onScan']; onUseUpload: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('Point your camera at the QR code on the karaoke screen.');

  useEffect(() => {
    if (!cameraSupported()) {
      setError('The camera only works on an HTTPS link.');
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
          const room = parseRoomQr(result.data);
          if (room) {
            stopped = true;
            navigator.vibrate?.(80);
            onScan(room);
            return;
          }
          setHint(NOT_A_ROOM);
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
            ? 'Camera permission was denied. Allow camera access in your browser settings.'
            : err.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : 'Couldn’t open the camera.',
        );
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  if (error) {
    return (
      <div className="scanner-message">
        <p className="error">{error}</p>
        <button type="button" className="primary" onClick={onUseUpload}>
          🖼️ Upload a QR image instead
        </button>
      </div>
    );
  }
  return (
    <>
      <div className="scanner-view">
        <video ref={videoRef} playsInline muted />
        <div className="scanner-frame" />
      </div>
      <p className="muted small">{hint}</p>
    </>
  );
}

function UploadScan({ onScan }: { onScan: Props['onScan'] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (a photo or screenshot).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const text = await decodeImageFile(file);
      const room = text ? parseRoomQr(text) : null;
      if (room) {
        navigator.vibrate?.(80);
        onScan(room);
      } else {
        setError(
          text ? NOT_A_ROOM : 'No QR code found in that image. Try a sharper photo where the whole QR code is visible.',
        );
      }
    } catch {
      setError('Couldn’t read that image. Try a different photo or screenshot.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ''; // lets the same file be chosen again
    }
  };

  // Desktop convenience: paste a screenshot with Ctrl+V / Cmd+V.
  const handleFileRef = useRef(handleFile);
  handleFileRef.current = handleFile;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) handleFileRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <>
      <label
        className={`scanner-drop${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <span className="scanner-drop-icon">🖼️</span>
        <strong>{busy ? 'Reading QR code…' : 'Choose a photo or screenshot'}</strong>
        <span className="muted small">of the QR code on the karaoke screen. You can also drop or paste an image here.</span>
      </label>
      {error && <p className="error small">{error}</p>}
    </>
  );
}
