"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CandidateTaller = {
  id: string;
  nombre: string;
  distanciaKm: number;
};

type Props = {
  incidenciaId: string;
  talleres: CandidateTaller[];
};

export function AcceptIncidenciaForm({ incidenciaId, talleres }: Props) {
  const [selectedTallerId, setSelectedTallerId] = useState(talleres[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setWarning("");

    const response = await fetch(`/api/incidencias/${incidenciaId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tallerId: selectedTallerId }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      warning?: string;
    };

    if (!response.ok) {
      setError(data.error ?? "No se pudo aceptar la incidencia");
      setLoading(false);
      return;
    }

    if (data.warning) {
      setWarning(data.warning);
    }

    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-semibold text-emerald-900">Aceptar incidencia</h3>
      <select
        value={selectedTallerId}
        onChange={(e) => setSelectedTallerId(e.target.value)}
        className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm"
      >
        {talleres.map((taller) => (
          <option key={taller.id} value={taller.id}>
            {taller.nombre} ({taller.distanciaKm} km)
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {warning ? <p className="text-sm text-amber-700">{warning}</p> : null}
      <button
        type="submit"
        disabled={loading || !selectedTallerId}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {loading ? "Procesando..." : "Aceptar incidencia"}
      </button>
    </form>
  );
}
