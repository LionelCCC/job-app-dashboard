import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  accent?: "indigo" | "green" | "yellow" | "blue" | "purple";
  subtitle?: string;
}

const accentMap = {
  indigo: {
    icon: "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20",
    value: "text-indigo-400",
  },
  green: {
    icon: "text-green-400 bg-green-500/10 border border-green-500/20",
    value: "text-green-400",
  },
  yellow: {
    icon: "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20",
    value: "text-yellow-400",
  },
  blue: {
    icon: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
    value: "text-blue-400",
  },
  purple: {
    icon: "text-purple-400 bg-purple-500/10 border border-purple-500/20",
    value: "text-purple-400",
  },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  accent = "indigo",
  subtitle,
}: StatsCardProps) {
  const colors = accentMap[accent];

  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600 transition-all duration-200 hover:bg-slate-800/80">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-400 truncate">{title}</p>
          <p
            className={clsx(
              "text-2xl font-bold mt-1 tabular-nums",
              colors.value
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={clsx(
                  "text-xs font-medium",
                  trend.positive !== false ? "text-green-400" : "text-red-400"
                )}
              >
                {trend.positive !== false ? "+" : ""}
                {trend.value}
              </span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", colors.icon)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
