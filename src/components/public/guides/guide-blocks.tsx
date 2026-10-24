import { InfoIcon, LightbulbIcon } from "lucide-react";
import type { GuideBlock } from "@/lib/guides";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";

/** One content block of a guide, inside a .prose-vl container. */
export function GuideBlockView({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case "ul":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>
              <RichText text={item} />
            </li>
          ))}
        </ol>
      );
    case "tip":
    case "note": {
      const Icon = block.type === "tip" ? LightbulbIcon : InfoIcon;
      return (
        <div
          className={
            block.type === "tip"
              ? "my-5 flex items-start gap-3 rounded-2xl bg-info-soft p-4 text-foreground"
              : "my-5 flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-foreground"
          }
        >
          <Icon className={block.type === "tip" ? "mt-1 size-4 shrink-0 text-info" : "mt-1 size-4 shrink-0 text-warning-strong"} aria-hidden />
          <span>
            <RichText text={block.text} />
          </span>
        </div>
      );
    }
    case "table": {
      const [head, ...rows] = block.rows;
      return (
        <div className="my-5 overflow-x-auto rounded-2xl border">
          {/* Two columns fit a phone; wider tables keep a minimum width and scroll inside their box. */}
          <table className={cn("w-full border-collapse text-left text-sm", (head?.length ?? 0) > 2 && "min-w-[32rem]")}>
            {head ? (
              <thead className="bg-muted/60 text-foreground">
                <tr>
                  {head.map((cell) => (
                    <th key={cell} scope="col" className="px-4 py-2.5 font-semibold">
                      <RichText text={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t">
                  {row.map((cell, c) => (
                    <td key={c} className={c === 0 ? "px-4 py-2.5 font-medium text-foreground" : "px-4 py-2.5"}>
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
}
