/**
 * Party-popper confetti (a newly created account; an admin signing in): two short bursts from the
 * lower left and right corners towards the centre, falling and fading out within about 2.7 s. A
 * fixed, click-through canvas on top of the page that removes itself, so it never takes clicks,
 * moves the layout or widens the page. Callers check the visitor's reduced-motion preference first.
 */

export type ConfettiPalette = readonly { color: string; weight: number }[];

/** Royal blue, cyan and white with a few gold accents (the public palette). */
export const CONFETTI_COLORS: ConfettiPalette = [
  { color: "#1d4ce9", weight: 20 },
  { color: "#4f7bff", weight: 15 },
  { color: "#22d3ee", weight: 18 },
  { color: "#67e8f9", weight: 12 },
  { color: "#ffffff", weight: 25 },
  { color: "#f5c542", weight: 10 },
];

/** Every piece is gone this long after its burst starts. */
export const MAX_LIFETIME_S = 2.4;
const FADE_S = 0.5;
const GRAVITY = 900;
const DRAG = 3.4;
const SECOND_BURST_DELAY_S = 0.12;
/** Hard stop for the whole effect (wall clock), even if frames were slow or skipped. */
const HARD_STOP_MS = 2900;
/** Over this last stretch before the hard stop everything fades out, so nothing vanishes abruptly. */
const HARD_FADE_MS = 450;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  shape: "rect" | "circle";
  rotation: number;
  spin: number;
  /** Phase of the paper "flip" and the sideways sway while falling. */
  flip: number;
  flipSpeed: number;
  sway: number;
  age: number;
  ttl: number;
  /** Seconds before this piece starts moving (the second burst). */
  delay: number;
}

export type Side = "left" | "right";
type Rand = () => number;

function pickColor(rand: Rand, palette: ConfettiPalette) {
  const total = palette.reduce((s, c) => s + c.weight, 0);
  let r = rand() * total;
  for (const c of palette) {
    r -= c.weight;
    if (r < 0) return c.color;
  }
  return palette[0]!.color;
}

/** Pieces per burst: fewer on small screens. */
export function burstSize(width: number) {
  return width < 640 ? 65 : width < 1024 ? 90 : 120;
}

/**
 * One burst from a lower corner, aimed at a point a little above the middle of the viewport so the
 * pieces meet in the centre, then fall.
 */
export function createBurst(
  side: Side,
  width: number,
  height: number,
  count: number,
  rand: Rand = Math.random,
  delay = 0,
  palette: ConfettiPalette = CONFETTI_COLORS,
): Particle[] {
  const x0 = side === "left" ? -8 : width + 8;
  const y0 = height + 8;
  const tx = width / 2;
  const ty = height * 0.42;
  const base = Math.atan2(ty - y0, tx - x0);
  const distance = Math.hypot(tx - x0, ty - y0);
  const small = width < 640;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = base + (rand() - 0.5) * 0.8;
    // Enough speed to reach the target against drag and gravity, with some spread in depth.
    const speed = (distance * DRAG * 1.12 + 420) * (0.78 + rand() * 0.42);
    const circle = rand() < 0.16;
    const size = (small ? 6.5 : 8) + rand() * (small ? 4 : 5);
    out.push({
      x: x0,
      y: y0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: circle ? size * 0.7 : size,
      h: circle ? size * 0.7 : size * (0.45 + rand() * 0.2),
      color: pickColor(rand, palette),
      shape: circle ? "circle" : "rect",
      rotation: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 12,
      flip: rand() * Math.PI * 2,
      flipSpeed: 5 + rand() * 7,
      sway: 14 + rand() * 26,
      age: 0,
      ttl: 1.9 + rand() * (MAX_LIFETIME_S - 1.9),
      delay,
    });
  }
  return out;
}

/** Advance one piece by `dt` seconds. Returns false once it has expired. */
export function stepParticle(p: Particle, dt: number): boolean {
  if (p.delay > 0) {
    p.delay -= dt;
    return true;
  }
  p.age += dt;
  if (p.age >= p.ttl) return false;
  const k = Math.exp(-DRAG * dt);
  p.vx *= k;
  p.vy = p.vy * k + (GRAVITY / DRAG) * (1 - k);
  p.flip += p.flipSpeed * dt;
  p.x += (p.vx + Math.sin(p.flip * 0.5) * p.sway) * dt;
  p.y += p.vy * dt;
  p.rotation += p.spin * dt;
  return true;
}

export function particleOpacity(p: Particle) {
  const left = p.ttl - p.age;
  return left >= FADE_S ? 1 : Math.max(0, left / FADE_S);
}

function draw(ctx: CanvasRenderingContext2D, p: Particle, fade: number, scale: number, outline: string) {
  if (p.delay > 0) return;
  ctx.globalAlpha = particleOpacity(p) * fade;
  // Position, spin and the paper turning over (one axis squashed with the flip phase) in one transform.
  const cos = Math.cos(p.rotation);
  const sin = Math.sin(p.rotation);
  const flip = Math.max(0.15, Math.abs(Math.cos(p.flip)));
  ctx.setTransform(cos * scale, sin * scale, -sin * flip * scale, cos * flip * scale, p.x * scale, p.y * scale);
  ctx.fillStyle = p.color;
  if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }
  if (p.color === "#ffffff") {
    // A faint coloured edge keeps white pieces visible on the light theme.
    ctx.lineWidth = 1;
    ctx.strokeStyle = outline;
    if (p.shape === "circle") ctx.stroke();
    else ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }
}

/**
 * Start the two bursts, in `palette` (default: the public one); `outline` edges the white pieces.
 * Returns a function that stops the effect and removes the canvas at once.
 */
export function launchConfetti({ palette = CONFETTI_COLORS, outline = "rgba(29, 76, 233, 0.35)" }: { palette?: ConfettiPalette; outline?: string } = {}): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  canvas.dataset.confetti = "";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "60",
  } satisfies Partial<CSSStyleDeclaration>);

  let width = 0;
  let height = 0;
  let scale = 1;
  const resize = () => {
    width = document.documentElement.clientWidth || window.innerWidth;
    height = window.innerHeight;
    // Small moving pieces don't need retina sharpness; fewer pixels keep phones smooth.
    scale = Math.min(window.devicePixelRatio || 1, width < 640 ? 1 : 1.5);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
  };
  resize();
  document.body.appendChild(canvas);

  const n = burstSize(width);
  let particles = [...createBurst("left", width, height, n, Math.random, 0, palette), ...createBurst("right", width, height, n, Math.random, SECOND_BURST_DELAY_S, palette)];

  let frame = 0;
  // The clock starts with the first frame actually shown: a hidden tab runs no frames, so a result
  // that arrives in the background still celebrates when the visitor comes back.
  let started = -1;
  let last = 0;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
  const tick = (now: number) => {
    if (started < 0) started = last = now;
    // Clamp the step so a busy tab doesn't make pieces jump.
    const dt = Math.min(0.034, Math.max(0, (now - last) / 1000));
    last = now;
    particles = particles.filter((p) => stepParticle(p, dt));
    const elapsed = now - started;
    const fade = Math.min(1, Math.max(0, (HARD_STOP_MS - elapsed) / HARD_FADE_MS));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) draw(ctx, p, fade, scale, outline);
    if (!particles.length || elapsed >= HARD_STOP_MS) return stop();
    frame = requestAnimationFrame(tick);
  };
  window.addEventListener("resize", resize);
  frame = requestAnimationFrame(tick);
  return stop;
}
