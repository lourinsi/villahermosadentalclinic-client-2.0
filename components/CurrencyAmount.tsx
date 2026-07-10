import React from "react";

type CurrencyTextProps = {
  value: React.ReactNode;
  className?: string;
  symbolClassName?: string;
  amountClassName?: string;
  title?: string;
};

export const formatPeso = (
  value?: number | string | null,
  options: Intl.NumberFormatOptions = {}
) => {
  const amount = Number(value || 0);
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString("en-PH", options)
    : "0";

  return `\u20b1${formatted}`;
};

export const normalizePesoText = (value: React.ReactNode) =>
  String(value ?? "")
    .replace(/\bPHP\s*/gi, "\u20b1")
    .replace(/\u20b1\s+/g, "\u20b1");

export function CurrencyText({
  value,
  className = "",
  symbolClassName = "",
  amountClassName = "",
  title,
}: CurrencyTextProps) {
  const text = normalizePesoText(value);
  const nodes: React.ReactNode[] = [];
  const moneyRegex = /([+-]?)\u20b1\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = moneyRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, sign, amount] = match;
    if (sign) nodes.push(sign);
    nodes.push(
      <span
        key={`symbol-${match.index}`}
        className={`inline-block align-baseline text-[0.72em] leading-none ${symbolClassName}`}
      >
        {"\u20b1"}
      </span>
    );
    nodes.push(
      <span key={`amount-${match.index}`} className={amountClassName}>
        {amount}
      </span>
    );
    lastIndex = moneyRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return (
    <span className={className} title={title || text}>
      {nodes.length > 0 ? nodes : text}
    </span>
  );
}
