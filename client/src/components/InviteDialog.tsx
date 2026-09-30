import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { inviteUrl } from '../lib/invite.ts';
import NewQrButton from './NewQrButton.tsx';

interface Props {
  code: string;
  inviteToken: string;
  isHost: boolean;
  onResetInvite: () => Promise<void>;
  onClose: () => void;
}

/** The room's QR code and invite link, so anyone in the room can bring friends in. */
export default function InviteDialog({ code, inviteToken, isHost, onResetInvite, onClose }: Props) {
  const url = inviteUrl(code, inviteToken);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard needs HTTPS; fall back to selecting the link so it can be copied by hand.
      const input = document.getElementById('invite-link') as HTMLInputElement | null;
      input?.select();
    }
  };

  const share = () =>
    navigator.share({ title: 'Join my karaoke room', text: `Join karaoke room ${code}`, url }).catch(() => {});

  // Rendered on <body> so the see-through cards (backdrop-filter) can't trap the overlay.
  return createPortal(
    <div className="scanner-backdrop" onClick={onClose}>
      <div className="scanner card invite" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Invite people">
        <h2>Invite people</h2>
        <div className="invite-qr">
          <QRCodeSVG value={url} size={220} marginSize={2} bgColor="#ffffff" fgColor="#000000" />
        </div>
        <p className="muted small center">Scan with a phone camera to join with just a name, no password needed.</p>
        <div className="invite-code">
          <span className="muted small">Room code</span>
          <span className="room-code">{code}</span>
        </div>
        <input id="invite-link" className="invite-link" value={url} readOnly onFocus={(e) => e.target.select()} />
        <div className="invite-actions">
          <button type="button" className="primary" onClick={copy}>
            {copied ? '✓ Copied' : '🔗 Copy link'}
          </button>
          {canShare && (
            <button type="button" onClick={share}>
              📤 Share
            </button>
          )}
        </div>
        <p className="muted small">Anyone with this link or QR code can join, so only share it with people you invite.</p>
        {isHost && <NewQrButton onReset={onResetInvite} />}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
