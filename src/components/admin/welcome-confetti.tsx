"use client";

import { useEffect } from "react";
import { launchConfetti, type ConfettiPalette } from "@/components/public/account/confetti";
import { ADMIN_WELCOME_COOKIE } from "@/lib/admin-welcome";

/** Birthday-party colours around the admin pink. */
const PARTY: ConfettiPalette = [
  { color: "#ed3189", weight: 22 },
  { color: "#ff8cc6", weight: 14 },
  { color: "#ffc83d", weight: 16 },
  { color: "#8b5cf6", weight: 14 },
  { color: "#22d3ee", weight: 12 },
  { color: "#ff7a45", weight: 8 },
  { color: "#ffffff", weight: 14 },
];

/**
 * Party poppers right after signing in: plays once when the "just signed in" cookie is there,
 * deleting it first so a reload or another tab doesn't celebrate again. Skipped (cookie still
 * cleared) for people who prefer reduced motion.
 */
export function WelcomeConfetti() {
  useEffect(() => {
    if (!document.cookie.split("; ").includes(`${ADMIN_WELCOME_COOKIE}=1`)) return;
    document.cookie = `${ADMIN_WELCOME_COOKIE}=; Max-Age=0; path=/admin; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // A moment for the dashboard to paint, so the poppers burst over it rather than a blank page.
    const timer = setTimeout(() => launchConfetti({ palette: PARTY, outline: "rgba(237, 49, 137, 0.4)" }), 250);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
