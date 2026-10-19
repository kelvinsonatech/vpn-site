/**
 * Three soft waves along the bottom of the sign-in page, drifting sideways at different speeds.
 * Each SVG is twice the screen width and holds two identical periods, so sliding it by half loops
 * without a seam. Decorative; still for people who prefer reduced motion.
 */
// One complete animation per layer (a separate duration class would lose to the shared shorthand).
const LAYERS = [
  { d: "M0 96 C360 40 1080 152 1440 96 C1800 40 2520 152 2880 96 V240 H0 Z", opacity: "opacity-[0.10]", motion: "motion-safe:animate-[wave-drift_34s_linear_infinite]" },
  { d: "M0 130 C360 70 1080 190 1440 130 C1800 70 2520 190 2880 130 V240 H0 Z", opacity: "opacity-[0.14]", motion: "motion-safe:animate-[wave-drift_26s_linear_infinite_reverse]" },
  { d: "M0 168 C360 128 1080 208 1440 168 C1800 128 2520 208 2880 168 V240 H0 Z", opacity: "opacity-[0.20]", motion: "motion-safe:animate-[wave-drift_20s_linear_infinite]" },
];

export function AuthWaves() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] min-h-56 overflow-hidden text-primary">
      {LAYERS.map((l) => (
        <svg
          key={l.d}
          viewBox="0 0 2880 240"
          preserveAspectRatio="none"
          className={`absolute bottom-0 left-0 h-full w-[200%] ${l.opacity} ${l.motion}`}
        >
          <path d={l.d} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}
