import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleCheckIcon } from "lucide-react";
import { AuthCard } from "@/components/admin/auth/auth-card";
import { RotatingTitle } from "@/components/admin/auth/rotating-title";
import { readSessionCookie } from "@/server/auth/cookies";
import { validateSessionToken } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await validateSessionToken(await readSessionCookie());
  if (s) redirect(s.admin.mfaEnabled && !s.session.mfaVerified ? "/admin/login/mfa" : "/admin");
  const signedOut = (await searchParams).signed_out === "1";
  return (
    <AuthCard heading={<RotatingTitle words={["Hello", "Welcome"]} label="Sign in" className="text-4xl font-bold tracking-tight" />}>
      {signedOut ? (
        <p role="status" className="mb-5 flex items-center justify-center gap-2 rounded-full bg-success-soft px-4 py-2 text-sm font-medium text-success animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
          <CircleCheckIcon className="size-4" aria-hidden />
          You&apos;ve been signed out.
        </p>
      ) : null}
      <LoginForm />
    </AuthCard>
  );
}
