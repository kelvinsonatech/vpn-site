import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth/auth-card";
import { readSessionCookie } from "@/server/auth/cookies";
import { validateSessionToken } from "@/server/auth/session";
import { logoutAction } from "../actions";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor authentication", robots: { index: false, follow: false } };

export default async function MfaPage() {
  const s = await validateSessionToken(await readSessionCookie());
  if (!s) redirect("/admin/login");
  if (!s.admin.mfaEnabled || s.session.mfaVerified) redirect("/admin");
  return (
    <AuthCard
      heading={
        <div className="grid gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">One more step</h1>
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">Signed in as {s.admin.email}</p>
        </div>
      }
    >
      <MfaForm />
      <form action={logoutAction} className="mt-4 text-center">
        <button type="submit" className="rounded text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Use a different account
        </button>
      </form>
    </AuthCard>
  );
}
