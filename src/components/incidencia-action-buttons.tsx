"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  incidenciaId: string;
  canAccept?: boolean;
  acceptTallerId?: string;
  canClose?: boolean;
};

export function IncidenciaActionButtons({
  incidenciaId,
  canAccept = false,
  acceptTallerId,
  canClose = false,
}: Props) {
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingClose, setLoadingClose] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function onAccept() {
    if (!acceptTallerId) return;
    setLoadingAccept(true);
    setError("");
    const response = await fetch(`/api/incidencias/${incidenciaId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tallerId: acceptTallerId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "No se pudo aceptar");
      setLoadingAccept(false);
      return;
    }
    router.refresh();
    setLoadingAccept(false);
  }

  async function onClose() {
    const trimmedReview = review.trim();
    if (!trimmedReview) {
      setError("Debes indicar como se ha resuelto la incidencia");
      return;
    }

    setLoadingClose(true);
    setError("");
    const response = await fetch(`/api/incidencias/${incidenciaId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidenciaReview: trimmedReview }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "No se pudo cerrar");
      setLoadingClose(false);
      return;
    }
    router.refresh();
    setLoadingClose(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {canAccept ? (
        <button
          type="button"
          onClick={onAccept}
          disabled={loadingAccept || !acceptTallerId}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {loadingAccept ? "Aceptando..." : "Aceptar incidencia"}
        </button>
      ) : null}
      {canClose ? (
        showCloseForm ? (
          <div className="space-y-2">
            <textarea
              value={review}
              onChange={(event) => setReview(event.target.value)}
              rows={3}
              placeholder="Describe como se ha resuelto la incidencia"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loadingClose}
                className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
              >
                {loadingClose ? "Cerrando..." : "Confirmar cierre"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseForm(false);
                  setReview("");
                  setError("");
                }}
                disabled={loadingClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowCloseForm(true);
              setError("");
            }}
            className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
          >
            Cerrar incidencia
          </button>
        )
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
