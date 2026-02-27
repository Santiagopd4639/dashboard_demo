"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateTallerForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setLoading(true);
    setMessage("");
    const formData = new FormData(formEl);
    const capacidadesRaw = String(formData.get("capacidades") ?? "pinchazo");
    const capacidades = capacidadesRaw
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

    const body = {
      nombre: String(formData.get("nombre") ?? "").trim(),
      capacidades,
      lat: formData.get("lat") ? Number(formData.get("lat")) : null,
      lng: formData.get("lng") ? Number(formData.get("lng")) : null,
      radioKm: Number(formData.get("radioKm") ?? 20),
      activo: Boolean(formData.get("activo")),
    };

    const response = await fetch("/api/talleres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear taller");
      setLoading(false);
      return;
    }

    setMessage("Taller creado correctamente");
    formEl.reset();
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6">
      <input name="nombre" required placeholder="Nombre" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input
        name="capacidades"
        defaultValue="pinchazo"
        placeholder="Capacidades (coma)"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input name="lat" type="number" step="any" placeholder="Lat" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="lng" type="number" step="any" placeholder="Lng" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="radioKm" type="number" step="0.1" defaultValue={20} placeholder="Radio km" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked />
        Activo
      </label>
      <button type="submit" disabled={loading} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">
        {loading ? "Creando..." : "Crear taller"}
      </button>
      {message ? <p className="text-sm text-slate-700 md:col-span-5">{message}</p> : null}
    </form>
  );
}
