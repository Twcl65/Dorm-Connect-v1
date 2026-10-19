"use client";

export type AccreditationProgressSegment = {
  status: string;
  count: number;
};

const STATUS_META: Record<string, { label: string; short: string; fill: string }> = {
  Pending: { label: "Pending", short: "Pnd", fill: "#f59e0b" },
  "Scheduled for Inspection": {
    label: "Scheduled",
    short: "Sch",
    fill: "#0ea5e9",
  },
  "Recommended for Approval": {
    label: "Recommended",
    short: "Rec",
    fill: "#6366f1",
  },
  Hold: { label: "On hold", short: "Hld", fill: "#f97316" },
  Approved: { label: "Approved", short: "App", fill: "#10b981" },
  Rejected: { label: "Rejected", short: "Rej", fill: "#ef4444" },
  Expired: { label: "Expired", short: "Exp", fill: "#94a3b8" },
};

const STATUS_ORDER = [
  "Pending",
  "Scheduled for Inspection",
  "Recommended for Approval",
  "Hold",
  "Approved",
  "Rejected",
  "Expired",
] as const;

const CHART = {
  width: 420,
  height: 150,
  padX: 8,
  padTop: 12,
  padBottom: 28,
};

type Props = {
  segments: AccreditationProgressSegment[];
  loading?: boolean;
};

function StatusBarChart({
  items,
  maxCount,
}: {
  items: { status: string; count: number; label: string; short: string; fill: string }[];
  maxCount: number;
}) {
  const plotW = CHART.width - CHART.padX * 2;
  const plotH = CHART.height - CHART.padTop - CHART.padBottom;
  const gap = 10;
  const barW = Math.max(18, (plotW - gap * (items.length - 1)) / items.length);

  return (
    <svg
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      className="h-[150px] w-full"
      role="img"
      aria-label="Accreditation requests by status"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = CHART.padTop + plotH * (1 - tick);
        const value = Math.round(maxCount * tick);
        return (
          <g key={tick}>
            <line
              x1={CHART.padX}
              y1={y}
              x2={CHART.width - CHART.padX}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={CHART.padX - 2}
              y={y + 3}
              textAnchor="end"
              className="fill-slate-400 text-[8px]"
            >
              {value}
            </text>
          </g>
        );
      })}

      {items.map((item, i) => {
        const barH = maxCount > 0 ? (item.count / maxCount) * plotH : 0;
        const x = CHART.padX + i * (barW + gap);
        const y = CHART.padTop + plotH - barH;

        return (
          <g key={item.status}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(barH, item.count > 0 ? 4 : 0)}
              rx={4}
              fill={item.fill}
              opacity={item.count > 0 ? 1 : 0.25}
            />
            {item.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-slate-600 text-[9px] font-semibold"
              >
                {item.count}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={CHART.height - 8}
              textAnchor="middle"
              className="fill-slate-500 text-[8px]"
            >
              {item.short}
            </text>
            <title>{`${item.label}: ${item.count}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

export function AccreditationProgressChart({ segments, loading }: Props) {
  const byStatus = new Map(segments.map((s) => [s.status, s.count]));
  const ordered = STATUS_ORDER.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
    ...STATUS_META[status],
  }));

  const total = ordered.reduce((sum, s) => sum + s.count, 0);
  const approved = byStatus.get("Approved") ?? 0;
  const inPipeline = ordered
    .filter((s) =>
      [
        "Pending",
        "Scheduled for Inspection",
        "Recommended for Approval",
        "Hold",
      ].includes(s.status)
    )
    .reduce((sum, s) => sum + s.count, 0);
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
  const maxCount = Math.max(...ordered.map((s) => s.count), 1);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-[150px] animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        No accreditation records yet. Progress will appear when landlords submit
        applications.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">{total}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[0.6rem] font-medium uppercase tracking-wide text-emerald-700">
            Approved
          </p>
          <p className="text-lg font-semibold tabular-nums text-emerald-800">
            {approvalRate}%
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[0.6rem] font-medium uppercase tracking-wide text-amber-800">
            Pipeline
          </p>
          <p className="text-lg font-semibold tabular-nums text-amber-900">
            {inPipeline}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 pb-1 pt-2">
        <p className="mb-1 px-1 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Requests by status
        </p>
        <StatusBarChart items={ordered} maxCount={maxCount} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-1">
          {ordered
            .filter((s) => s.count > 0)
            .map((s) => (
              <span
                key={s.status}
                className="inline-flex items-center gap-1 text-[0.65rem] text-slate-600"
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: s.fill }}
                />
                {s.label} ({s.count})
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
