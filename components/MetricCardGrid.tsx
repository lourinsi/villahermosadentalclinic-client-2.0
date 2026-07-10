import type { LucideIcon } from "lucide-react";
import { Card, CardTitle } from "./ui/card";
import { CurrencyText } from "./CurrencyAmount";

export type MetricCardDefinition = {
  id: string;
  title: string;
  value: React.ReactNode;
  helper: string;
  icon: LucideIcon;
  iconClass: string;
  pillClass: string;
};

type MetricCardGridProps = {
  metrics: MetricCardDefinition[];
  className?: string;
};

/**
 * Shared visual treatment for the high-level metrics shown across clinic views.
 * Page components own their calculations; this component owns the presentation.
 */
export function MetricCardGrid({
  metrics,
  className = "grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4 xl:gap-6",
}: MetricCardGridProps) {
  return (
    <div className={className} aria-label="Key metrics">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <Card
            key={metric.id}
            className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-md sm:rounded-2xl sm:p-4 md:p-5 xl:p-6"
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4 xl:gap-5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 xl:h-14 xl:w-14 ${metric.iconClass} transition-colors duration-300`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 xl:h-7 xl:w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="min-w-0 truncate text-[11px] font-black uppercase tracking-wider text-slate-400 sm:text-sm xl:text-base">
                  {metric.title}
                </CardTitle>
                <div className="mt-2 flex min-w-0 items-center gap-1.5 sm:mt-3 sm:gap-3">
                  {/* 1. Added shrink-0 and removed truncate from the number */}
                  <span className="shrink-0 text-xl font-black tracking-tight text-gray-900 sm:text-2xl xl:text-3xl">
                    <CurrencyText value={metric.value} />
                  </span>
                  
                  {/* 2. Ensured the badge has min-w-0, shrink, and truncate */}
                  <span className={`min-w-0 shrink truncate rounded-full px-2 py-0.5 text-center text-[10px] font-black leading-4 sm:max-w-[10rem] sm:px-3 sm:py-1 sm:text-xs ${metric.pillClass}`}>
                    {metric.helper}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 sm:mt-5 xl:mt-6" />
          </Card>
        );
      })}
    </div>
  );
}
