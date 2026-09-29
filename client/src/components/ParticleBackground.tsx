import { useEffect, useRef } from 'react';

interface Note {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 (far, small, dim, slow) .. 1 (near, big, bright, fast) */
  depth: number;
  size: number;
  glyph: number;
  phase: number;
  /** 0..1, eases toward 1 while the cursor is near */
  lit: number;
}

// U+FE0E asks for the plain text glyph rather than a colour emoji.
const GLYPHS = ['♪︎', '♫︎', '♬︎', '♩︎'];
const COLOR = '#6ea8fe';
const COLOR_LIT = '#dbeafe';
const CURSOR_RADIUS = 180; // px: how far the cursor's pull reaches
const SPRITE_PX = 64;

/** Pre-renders each note glyph once per colour so frames only need cheap drawImage calls. */
function makeSprites(color: string, dpr: number) {
  return GLYPHS.map((glyph) => {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_PX * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${SPRITE_PX * 0.8}px "Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols", "DejaVu Sans", sans-serif`;
    g.fillText(glyph, SPRITE_PX / 2, SPRITE_PX / 2);
    return c;
  });
}

/**
 * Full-page canvas of music notes that float upward, sway, and are drawn toward the cursor
 * (or finger). Sits behind the page content and ignores pointer events.
 */
export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: -9999, y: -9999, active: false };
    let notes: Note[] = [];
    let sprites: HTMLCanvasElement[] = [];
    let litSprites: HTMLCanvasElement[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let time = 0;

    const riseSpeed = (n: Note) => 0.25 + n.depth * 0.45; // px per 60fps frame

    const spawn = (y?: number): Note => {
      const depth = Math.random() ** 1.5; // more small, distant notes than big ones
      const note: Note = {
        x: Math.random() * width,
        y: y ?? Math.random() * height,
        vx: 0,
        vy: 0,
        depth,
        size: 12 + depth * 20,
        glyph: Math.floor(Math.random() * GLYPHS.length),
        phase: Math.random() * Math.PI * 2,
        lit: 0,
      };
      note.vy = -riseSpeed(note);
      return note;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sprites = makeSprites(COLOR, dpr);
      litSprites = makeSprites(COLOR_LIT, dpr);

      // Phones get a higher density so a few notes still show around the cards.
      const count = Math.max(32, Math.min(80, Math.round((width * height) / 16000)));
      notes = Array.from({ length: count }, (_, i) => {
        const old = notes[i];
        return old ? { ...old, x: Math.min(old.x, width), y: Math.min(old.y, height) } : spawn();
      });
      if (reduceMotion) draw();
    };

    // dt = elapsed time in 60fps frames, so motion looks the same on 60Hz, 120Hz and 144Hz screens.
    const step = (dt: number) => {
      time += dt;
      for (const n of notes) {
        let near = false;
        if (pointer.active) {
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CURSOR_RADIUS && dist > 0.1) {
            near = true;
            // Pull toward the cursor, but push back when very close so they orbit instead of clumping.
            const strength = (1 - dist / CURSOR_RADIUS) * (dist < 45 ? -0.08 : 0.05);
            n.vx += (dx / dist) * strength * dt;
            n.vy += (dy / dist) * strength * dt;
          }
        }
        n.lit += ((near ? 1 : 0) - n.lit) * Math.min(1, 0.1 * dt);

        // Ease back to the resting motion: rising, with no sideways drift.
        const settle = 1 - 0.97 ** dt;
        n.vx += (0 - n.vx) * settle;
        n.vy += (-riseSpeed(n) - n.vy) * settle;

        const sway = Math.sin(time * 0.02 + n.phase) * (0.25 + n.depth * 0.35);
        n.x += (n.vx + sway) * dt;
        n.y += n.vy * dt;

        // Leaving the top: come back in from below. Wrap sideways.
        if (n.y < -40) Object.assign(n, spawn(height + 40));
        else if (n.y > height + 60) n.y = -40;
        if (n.x < -40) n.x = width + 40;
        else if (n.x > width + 40) n.x = -40;
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (pointer.active) {
        const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, CURSOR_RADIUS);
        glow.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
        glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(pointer.x - CURSOR_RADIUS, pointer.y - CURSOR_RADIUS, CURSOR_RADIUS * 2, CURSOR_RADIUS * 2);

        // Faint strings from the cursor to the notes it is holding.
        ctx.lineWidth = 1;
        for (const n of notes) {
          if (n.lit < 0.05) continue;
          ctx.strokeStyle = `rgba(147, 197, 253, ${n.lit * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }

      for (const n of notes) {
        const size = n.size * (1 + n.lit * 0.3);
        const tilt = Math.sin(time * 0.015 + n.phase) * 0.3; // about ±17°
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(tilt);
        ctx.globalAlpha = 0.25 + n.depth * 0.45;
        ctx.drawImage(sprites[n.glyph], -size / 2, -size / 2, size, size);
        if (n.lit > 0.02) {
          ctx.globalAlpha = n.lit;
          ctx.drawImage(litSprites[n.glyph], -size / 2, -size / 2, size, size);
        }
        ctx.restore();
      }
    };

    let last = 0;
    const loop = (now: number) => {
      // Cap dt so returning to the tab doesn't make notes jump.
      const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
      last = now;
      step(dt);
      draw();
      frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    // A finger lifting off the screen shouldn't leave a "ghost cursor" behind.
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') onLeave();
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (document.visibilityState === 'visible' && !reduceMotion) frame = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduceMotion) {
      draw();
    } else {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onMove, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      document.addEventListener('visibilitychange', onVisibility);
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-bg" aria-hidden="true" />;
}
