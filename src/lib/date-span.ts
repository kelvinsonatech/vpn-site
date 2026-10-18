/** Whole calendar years, months and days between two moments (UTC dates; times of day ignored). */
export interface DateSpan {
  years: number;
  months: number;
  days: number;
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * The span from `from` to `to`, like counting on a calendar ("15 Sep 1997" → "18 Oct 2026" is 29 y,
 * 1 m, 3 d): whole months up to the last monthly anniversary, then the days after it. An anniversary
 * that falls past a month's end lands on its last day (31 Jan + 1 month = 29 Feb in 2024; 29 Feb
 * 2020 + 1 year = 28 Feb 2021). Zero if `to` isn't later.
 */
export function calendarSpan(from: Date, to: Date): DateSpan {
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const anniversary = (months: number) => {
    const total = from.getUTCMonth() + months;
    const year = from.getUTCFullYear() + Math.floor(total / 12);
    const month = ((total % 12) + 12) % 12;
    return Date.UTC(year, month, Math.min(from.getUTCDate(), daysInMonth(year, month)));
  };
  if (!(end > anniversary(0))) return { years: 0, months: 0, days: 0 };
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
  if (anniversary(months) > end) months--;
  return { years: Math.floor(months / 12), months: months % 12, days: Math.round((end - anniversary(months)) / 86_400_000) };
}

/** Whole days between the two dates (UTC calendar days). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "29 years, 1 month and 3 days"; parts that are zero are left out; "0 days" for an empty span. */
export function formatSpan({ years, months, days }: DateSpan): string {
  const parts = [years && unit(years, "year"), months && unit(months, "month"), days && unit(days, "day")].filter(Boolean) as string[];
  if (!parts.length) return "0 days";
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
