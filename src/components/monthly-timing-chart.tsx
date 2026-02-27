"use client";

import { useMemo, useState } from "react";

type TimingSample = {
  tallerId: string;
  tallerNombre: string;
  acceptedAt: string;
  openToAcceptMinutes: number;
  acceptToCompleteMinutes: number | null;
};

type TallerOption = {
  id: string;
  nombre: string;
};

type Granularity = "day" | "week" | "month";

type Props = {
  samples: TimingSample[];
  talleres: TallerOption[];
};

type Point = {
  key: string;
  label: string;
  avgOpenToAccept: number | null;
  avgAcceptToComplete: number | null;
  countOpenToAccept: number;
  countAcceptToComplete: number;
};

function formatMinutes(minutes: number | null) {
  if (minutes === null) return "Sin datos";
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(2)} h`;
  const days = hours / 24;
  return `${days.toFixed(2)} d`;
}

function startOfISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function periodKey(date: Date, granularity: Granularity) {
  if (granularity === "day") {
    return date.toISOString().slice(0, 10);
  }
  if (granularity === "week") {
    const start = startOfISOWeek(date);
    return start.toISOString().slice(0, 10);
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(key: string, granularity: Granularity) {
  if (granularity === "day") {
    const d = new Date(`${key}T00:00:00Z`);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }
  if (granularity === "week") {
    const d = new Date(`${key}T00:00:00Z`);
    return `Sem ${d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`;
  }
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, (month || 1) - 1, 1));
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
}

function linePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
}

function areaPath(points: Array<{ x: number; y: number }>, baseY: number) {
  if (points.length === 0) return "";
  const start = points[0];
  const end = points[points.length - 1];
  return `M ${start.x} ${baseY} L ${points.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${end.x} ${baseY} Z`;
}

export function MonthlyTimingChart({ samples, talleres }: Props) {
  const [selectedTallerId, setSelectedTallerId] = useState<string>("all");
  const [granularity, setGranularity] = useState<Granularity>("month");

  const talleresWithAll = useMemo(
    () => [{ id: "all", nombre: "Todos los talleres" }, ...talleres],
    [talleres],
  );

  const selectedName =
    talleresWithAll.find((t) => t.id === selectedTallerId)?.nombre ?? "Taller";

  const filteredSamples = useMemo(() => {
    if (selectedTallerId === "all") return samples;
    return samples.filter((s) => s.tallerId === selectedTallerId);
  }, [samples, selectedTallerId]);

  const points = useMemo<Point[]>(() => {
    const grouped = new Map<
      string,
      {
        openSum: number;
        openCount: number;
        completeSum: number;
        completeCount: number;
      }
    >();

    for (const sample of filteredSamples) {
      const d = new Date(sample.acceptedAt);
      const key = periodKey(d, granularity);
      if (!grouped.has(key)) {
        grouped.set(key, {
          openSum: 0,
          openCount: 0,
          completeSum: 0,
          completeCount: 0,
        });
      }
      const bucket = grouped.get(key)!;
      bucket.openSum += sample.openToAcceptMinutes;
      bucket.openCount += 1;
      if (sample.acceptToCompleteMinutes !== null) {
        bucket.completeSum += sample.acceptToCompleteMinutes;
        bucket.completeCount += 1;
      }
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket]) => ({
        key,
        label: periodLabel(key, granularity),
        avgOpenToAccept: bucket.openCount > 0 ? bucket.openSum / bucket.openCount : null,
        avgAcceptToComplete:
          bucket.completeCount > 0 ? bucket.completeSum / bucket.completeCount : null,
        countOpenToAccept: bucket.openCount,
        countAcceptToComplete: bucket.completeCount,
      }));
  }, [filteredSamples, granularity]);

  const chartData = useMemo(() => {
    const width = 980;
    const height = 360;
    const margin = { top: 24, right: 28, bottom: 56, left: 54 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const values = points.flatMap((p) => [p.avgOpenToAccept ?? 0, p.avgAcceptToComplete ?? 0]);
    const maxY = Math.max(1, ...values);

    const xFor = (index: number) => {
      if (points.length <= 1) return margin.left + plotWidth / 2;
      return margin.left + (index / (points.length - 1)) * plotWidth;
    };
    const yFor = (value: number) => margin.top + (1 - value / maxY) * plotHeight;

    const openPoints = points
      .map((p, i) =>
        p.avgOpenToAccept !== null ? { x: xFor(i), y: yFor(p.avgOpenToAccept), point: p } : null,
      )
      .filter((p): p is { x: number; y: number; point: Point } => p !== null);

    const completePoints = points
      .map((p, i) =>
        p.avgAcceptToComplete !== null
          ? { x: xFor(i), y: yFor(p.avgAcceptToComplete), point: p }
          : null,
      )
      .filter((p): p is { x: number; y: number; point: Point } => p !== null);

    const baseY = margin.top + plotHeight;

    return {
      width,
      height,
      margin,
      maxY,
      baseY,
      xLabels: points.map((p) => p.label),
      yTicks: [0, maxY / 3, (maxY * 2) / 3, maxY],
      openPoints,
      completePoints,
      openLine: linePath(openPoints),
      completeLine: linePath(completePoints),
      openArea: areaPath(openPoints, baseY),
      completeArea: areaPath(completePoints, baseY),
    };
  }, [points]);

  const openAvg = useMemo(() => {
    const vals = points.map((p) => p.avgOpenToAccept).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [points]);

  const completeAvg = useMemo(() => {
    const vals = points.map((p) => p.avgAcceptToComplete).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [points]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Analytics</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Media de tiempos</h3>
          <p className="mt-1 text-sm text-slate-600">Vista: {selectedName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={selectedTallerId}
            onChange={(e) => setSelectedTallerId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2"
          >
            {talleresWithAll.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            className="rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="day">Diaria</option>
            <option value="week">Semanal</option>
            <option value="month">Mensual</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-100/60 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Apertura a aceptacion</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatMinutes(openAvg)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-100/60 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Aceptacion a completada</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatMinutes(completeAvg)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-100/60 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Puntos</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{points.length}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-xs">
        <span className="inline-flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4f46e5]" />
          Apertura a aceptacion
        </span>
        <span className="inline-flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-[#06b6d4]" />
          Aceptacion a completada
        </span>
      </div>

      {points.length < 2 ? (
        <p className="mt-4 text-sm text-slate-600">
          Para ver lineas completas necesitas al menos 2 periodos con datos. Prueba cambiar a
          vista diaria/semanal o seleccionar "Todos los talleres".
        </p>
      ) : null}

      {points.length === 0 ? (
        <p className="mt-5 text-sm text-slate-600">No hay datos para esta combinacion.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/40 p-3">
          <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} className="min-w-[780px] w-full">
            <defs>
              <linearGradient id="openArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="completeArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {chartData.yTicks.map((tick, idx) => {
              const y =
                chartData.margin.top +
                (1 - tick / chartData.maxY) *
                  (chartData.height - chartData.margin.top - chartData.margin.bottom);
              return (
                <g key={idx}>
                  <line
                    x1={chartData.margin.left}
                    y1={y}
                    x2={chartData.width - chartData.margin.right}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.12"
                  />
                  <text x={chartData.margin.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.65">
                    {formatMinutes(tick)}
                  </text>
                </g>
              );
            })}

            {chartData.openArea ? <path d={chartData.openArea} fill="url(#openArea)" /> : null}
            {chartData.completeArea ? <path d={chartData.completeArea} fill="url(#completeArea)" /> : null}
            {chartData.openLine ? <path d={chartData.openLine} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" /> : null}
            {chartData.completeLine ? <path d={chartData.completeLine} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" /> : null}

            {chartData.openPoints.map((p) => (
              <circle
                key={`o-${p.point.key}`}
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#4f46e5"
                stroke="#fff"
                strokeWidth="1.1"
                className="cursor-pointer"
              >
                <title>
                  {`${p.point.label} | Apertura a aceptacion: ${formatMinutes(
                    p.point.avgOpenToAccept,
                  )} (${p.point.countOpenToAccept})`}
                </title>
              </circle>
            ))}
            {chartData.completePoints.map((p) => (
              <circle
                key={`c-${p.point.key}`}
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#06b6d4"
                stroke="#fff"
                strokeWidth="1.1"
                className="cursor-pointer"
              >
                <title>
                  {`${p.point.label} | Aceptacion a completada: ${formatMinutes(
                    p.point.avgAcceptToComplete,
                  )} (${p.point.countAcceptToComplete})`}
                </title>
              </circle>
            ))}

            {chartData.xLabels.map((label, idx) => {
              const x =
                chartData.margin.left +
                (chartData.xLabels.length <= 1
                  ? (chartData.width - chartData.margin.left - chartData.margin.right) / 2
                  : (idx / (chartData.xLabels.length - 1)) *
                    (chartData.width - chartData.margin.left - chartData.margin.right));
              return (
                <text key={`x-${idx}`} x={x} y={chartData.height - 16} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.72">
                  {label}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
