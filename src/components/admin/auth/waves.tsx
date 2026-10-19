/**
 * Three soft waves along the bottom of the sign-in page, drifting sideways at different speeds.
 * Each SVG is twice the screen width and holds two identical periods, so sliding it by half loops
 * without a seam. Decorative; still for people who prefer reduced motion.
 */
const LAYERS = [
  { d: "M0 96 C360 40 1080 152 1440 96 C1800 40 2520 152 2880 96 V240 H0 Z", opacity: "opacity-[0.10]", speed: "[animation-duration:34s]", reverse: false },
  { d: "M0 130 C360 70 1080 190 1440 130 C1800 70 2520 190 2880 130 V240 H0 Z", opacity: "opacity-[0.14]", speed: "[animation-duration:26s]", reverse: true },
  { d: "M0 168 C360 128 1080 208 1440 168 C1800 128 2520 208 2880 168 V240 H0 Z", opacity: "opacity-[0.20]", speed: "[animation-duration:20s]", reverse: false },
];

export function AuthWaves() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] min-h-56 overflow-hidden text-primary">
      {LAYERS.map((l) => (
        <svg
          key={l.d}
          viewBox="0 0 2880 240"
          preserveAspectRatio="none"
          className={`absolute bottom-0 left-0 h-full w-[200%] motion-safe:animate-wave-drift ${l.opacity} ${l.speed} ${l.reverse ? "[animation-direction:reverse]" : ""}`}
        >
          <path d={l.d} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}
