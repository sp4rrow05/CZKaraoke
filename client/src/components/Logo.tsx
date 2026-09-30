import { Link } from 'react-router-dom';

interface Props {
  /** Rendered width in CSS pixels; height follows the image's proportions. */
  width: number;
  /** Wrap in a link to the home page. */
  linkHome?: boolean;
  className?: string;
}

// logo.webp / logo.png are 640×518.
const RATIO = 518 / 640;

/** The CZKaraoke neon logo (WebP, with a PNG fallback for older browsers). */
export default function Logo({ width, linkHome, className = '' }: Props) {
  const img = (
    <picture className={`logo ${className}`}>
      <source srcSet="/logo.webp" type="image/webp" />
      <img src="/logo.png" alt="CZKaraoke" width={width} height={Math.round(width * RATIO)} decoding="async" />
    </picture>
  );
  return linkHome ? (
    <Link to="/" className="logo-link" title="CZKaraoke home">
      {img}
    </Link>
  ) : (
    img
  );
}
