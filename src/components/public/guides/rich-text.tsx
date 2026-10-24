import Link from "next/link";

/** **bold** and [label](/internal/path); nothing else is interpreted (see src/lib/guides/types.ts). */
const MARK = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/g;

export function RichText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] ? (
        <strong key={m.index}>{m[1]}</strong>
      ) : (
        <Link key={m.index} href={m[3]!}>
          {m[2]}
        </Link>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
