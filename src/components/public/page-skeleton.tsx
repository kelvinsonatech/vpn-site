import { Skeleton } from "@/components/ui/skeleton";
import { HeroWave } from "./hero-wave";
import { COUNTRY_GRID, Container, SERVER_GRID } from "./section";

/** Loading state for browse pages: a hero band with placeholder text and a grid of card skeletons. */
export function PageSkeleton({ cards = 6, variant = "country" }: { cards?: number; variant?: "country" | "server" }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="relative isolate overflow-hidden bg-hero">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-10 pb-24 sm:px-6 sm:pb-32">
          <div className="h-4 w-40 rounded-full bg-white/20" />
          <div className="mt-10 size-16 rounded-2xl bg-white/20" />
          <div className="mt-6 h-9 w-72 max-w-full rounded-xl bg-white/25 sm:h-12 sm:w-[28rem]" />
          <div className="mt-4 h-4 w-80 max-w-full rounded-full bg-white/15" />
          <div className="mt-2 h-4 w-64 max-w-full rounded-full bg-white/15" />
          <div className="mt-7 flex gap-2.5">
            <div className="h-8 w-28 rounded-full bg-white/15" />
            <div className="h-8 w-32 rounded-full bg-white/15" />
            <div className="hidden h-8 w-24 rounded-full bg-white/15 sm:block" />
          </div>
        </div>
        <HeroWave className="absolute inset-x-0 -bottom-px" />
      </div>
      <Container className="pt-6">
        <div className="mx-auto mb-10 flex max-w-md flex-col items-center gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className={variant === "country" ? COUNTRY_GRID : SERVER_GRID}>
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="flex flex-col items-center rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex w-full justify-between">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              {variant === "country" ? <Skeleton className="mt-6 size-28 rounded-[1.6rem]" /> : <Skeleton className="mt-6 h-6 w-40" />}
              <Skeleton className="mt-4 h-5 w-32" />
              <div className="mt-6 w-full space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                {variant === "server" ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-14 w-full rounded-2xl" />
                  </>
                ) : null}
              </div>
              <Skeleton className="mt-6 h-11 w-full rounded-full" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}

/** Loading state of the home page: the hero (badge, title, buttons, stat tiles; the picture from md) and the service cards. */
export function HomePageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="relative isolate overflow-hidden bg-hero">
        <Container className="relative grid items-center gap-12 pt-12 pb-28 sm:pt-16 sm:pb-36 lg:grid-cols-2 lg:gap-8 lg:pt-20 lg:pb-44">
          <div className="flex flex-col items-center lg:items-start">
            <div className="h-8 w-60 max-w-full rounded-full bg-white/15" />
            <div className="mt-6 h-10 w-80 max-w-full rounded-xl bg-white/25 sm:h-12 lg:h-14 lg:w-[28rem]" />
            <div className="mt-3 h-10 w-64 max-w-full rounded-xl bg-white/25 sm:h-12 lg:h-14 lg:w-80" />
            <div className="mt-6 h-4 w-full max-w-xl rounded-full bg-white/15" />
            <div className="mt-2.5 h-4 w-5/6 max-w-lg rounded-full bg-white/15" />
            <div className="mt-2.5 h-4 w-2/3 max-w-md rounded-full bg-white/15" />
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <div className="h-12 w-full rounded-full bg-white/30 sm:w-52" />
              <div className="h-12 w-full rounded-full bg-white/15 sm:w-48" />
            </div>
            <div className="mt-10 grid w-full max-w-lg grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-[4.5rem] rounded-2xl bg-white/10 ring-1 ring-white/15 sm:h-20" />
              ))}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="mx-auto aspect-square w-full max-w-[30rem] rounded-full bg-white/10" />
          </div>
        </Container>
        <HeroWave className="absolute inset-x-0 -bottom-px" />
      </div>
      <Container className="pt-6 sm:pt-10">
        <div className="mx-auto mb-10 flex max-w-md flex-col items-center gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col items-center rounded-[1.75rem] border bg-card p-5 pt-6 shadow-sm sm:p-6">
              <div className="flex w-full justify-between">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-5 size-16 rounded-2xl" />
              <Skeleton className="mt-5 h-6 w-28" />
              <Skeleton className="mt-3 h-4 w-56 max-w-full" />
              <div className="mt-6 w-full space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
              <Skeleton className="mt-8 h-11 w-full rounded-full" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
