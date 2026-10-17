import { beforeEach, describe, expect, it, vi } from "vitest";
import { burstSize, CONFETTI_COLORS, createBurst, MAX_LIFETIME_S, particleOpacity, stepParticle } from "@/components/public/account/confetti";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** Fresh module state, as after a page reload (only sessionStorage survives). */
async function freshClaim() {
  vi.resetModules();
  return (await import("@/components/public/account/celebration")).claimCelebration;
}

describe("celebration once per account", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("celebrates a request the first time only", async () => {
    const claim = await freshClaim();
    expect(claim("req-aaaaaaaa", storage)).toBe(true);
    expect(claim("req-aaaaaaaa", storage)).toBe(false);
    expect(claim("req-bbbbbbbb", storage)).toBe(true);
  });

  it("does not replay after a reload or a return to the page in the same tab", async () => {
    expect((await freshClaim())("req-cccccccc", storage)).toBe(true);
    expect((await freshClaim())("req-cccccccc", storage)).toBe(false);
  });

  it("stores request ids only and keeps the list short", async () => {
    const claim = await freshClaim();
    for (let i = 0; i < 30; i++) claim(`req-${String(i).padStart(8, "0")}`, storage);
    const stored = JSON.parse(storage.getItem("vl:celebrated")!) as string[];
    expect(stored).toHaveLength(20);
    expect(stored.at(-1)).toBe("req-00000029");
    expect(stored.every((v) => /^req-\d{8}$/.test(v))).toBe(true);
  });

  it("still plays once when storage is blocked or corrupted", async () => {
    const blocked = memoryStorage();
    blocked.getItem = () => {
      throw new Error("blocked");
    };
    blocked.setItem = () => {
      throw new Error("blocked");
    };
    const claim = await freshClaim();
    expect(claim("req-dddddddd", blocked)).toBe(true);
    expect(claim("req-dddddddd", blocked)).toBe(false);

    storage.setItem("vl:celebrated", "{not json");
    expect(claim("req-eeeeeeee", storage)).toBe(true);
    expect(claim("", storage)).toBe(false);
  });
});

describe("confetti bursts", () => {
  /** Deterministic random numbers. */
  function seeded(seed = 7) {
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  }

  it("fires from the lower corners towards the centre", () => {
    const [w, h] = [1440, 900];
    const left = createBurst("left", w, h, 50, seeded());
    const right = createBurst("right", w, h, 50, seeded(11));
    for (const p of left) {
      expect(p.x).toBeLessThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(h);
      expect(p.vx).toBeGreaterThan(0);
      expect(p.vy).toBeLessThan(0);
    }
    for (const p of right) {
      expect(p.x).toBeGreaterThanOrEqual(w);
      expect(p.vx).toBeLessThan(0);
      expect(p.vy).toBeLessThan(0);
    }
  });

  it.each([
    [390, 844],
    [1440, 900],
  ])("reaches the middle of a %ix%i screen, then falls and is gone within 3 s", (w, h) => {
    const pieces = [...createBurst("left", w, h, 200, seeded()), ...createBurst("right", w, h, 200, seeded(3), 0.12)];
    const apex: number[] = [];
    let t = 0;
    for (const p of pieces) {
      let top = Infinity;
      let life = 0;
      while (stepParticle(p, 1 / 60)) {
        life += 1 / 60;
        top = Math.min(top, p.y);
      }
      t = Math.max(t, life);
      apex.push(top / h);
    }
    apex.sort((a, b) => a - b);
    const median = apex[Math.floor(apex.length / 2)]!;
    expect(median).toBeGreaterThan(0.3);
    expect(median).toBeLessThan(0.6);
    expect(t).toBeLessThanOrEqual(MAX_LIFETIME_S + 0.12 + 0.02);
    expect(t).toBeLessThan(3);
  });

  it("fades out instead of vanishing", () => {
    const [p] = createBurst("left", 800, 600, 1, seeded());
    expect(particleOpacity(p!)).toBe(1);
    p!.age = p!.ttl - 0.25;
    expect(particleOpacity(p!)).toBeCloseTo(0.5, 1);
  });

  it("uses the site colours with gold as a small accent, and fewer pieces on phones", () => {
    const palette = new Set<string>(CONFETTI_COLORS.map((c) => c.color));
    const pieces = createBurst("left", 1440, 900, 2000, seeded());
    expect(pieces.every((p) => palette.has(p.color))).toBe(true);
    const gold = pieces.filter((p) => p.color === "#f5c542").length / pieces.length;
    expect(gold).toBeGreaterThan(0.04);
    expect(gold).toBeLessThan(0.16);
    expect(burstSize(375)).toBeLessThan(burstSize(1440));
  });
});
