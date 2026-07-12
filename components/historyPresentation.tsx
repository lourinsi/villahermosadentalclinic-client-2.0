import { CurrencyText } from "./CurrencyAmount";

export type HistoryBadgeTone =
  | "appointment"
  | "payment"
  | "amount"
  | "adjustment"
  | "deleted"
  | "restored"
  | "recorded"
  | "violet";

export type HistoryBadge = {
  label: string;
  tone: HistoryBadgeTone;
};

export const getHistoryBadgeClass = (tone: HistoryBadgeTone) => {
  if (tone === "payment" || tone === "restored") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "amount") return "border-green-200 bg-green-50 text-green-700";
  if (tone === "adjustment") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "deleted") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "violet" || tone === "recorded") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
};

/** A compact badge used in both appointment and expense audit timelines. */
export function HistoryBadgePill({ badge, className = "" }: { badge: HistoryBadge; className?: string }) {
  return (
    <span
      className={`max-w-[11rem] truncate rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-tight sm:px-2.5 sm:py-1 ${getHistoryBadgeClass(badge.tone)} ${className}`}
      title={badge.label}
    >
      <CurrencyText value={badge.label} />
    </span>
  );
}
