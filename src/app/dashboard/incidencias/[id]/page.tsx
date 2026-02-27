import Link from "next/link";
import { notFound } from "next/navigation";
import { AcceptIncidenciaForm } from "@/components/accept-incidencia-form";
import { getAuthUserFromCookies, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleIncidenciasForUser } from "@/lib/incidencias-service";
import { IncidenciaActionButtons } from "@/components/incidencia-action-buttons";

function isOpenAcceptanceState(estado: string) {
  const normalized = estado.trim().toLowerCase().replaceAll("_", " ");
  return normalized === "aceptacion" || normalized === "en aceptacion" || normalized === "pendiente";
}

export default async function IncidenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAuthUserFromCookies();
  if (!user) return null;
  const admin = isAdminRole(user.rol);

  const incidencia = await db.incidencia.findUnique({
    where: { id },
    include: {
      aceptacionIncidencia: {
        include: {
          taller: true,
        },
      },
    },
  });

  if (!incidencia) notFound();

  let accepterCandidates: { id: string; nombre: string; distanciaKm: number }[] = [];
  let acceptedByMine = false;
  if (!admin) {
    const visibles = await getVisibleIncidenciasForUser(user, "all");
    const visible = visibles.find((v) => v.id === incidencia.id);
    acceptedByMine =
      incidencia.aceptacionIncidencia !== null &&
      user.talleres.some((t) => t.id === incidencia.aceptacionIncidencia?.tallerId);
    const canSee = Boolean(visible) || acceptedByMine;
    if (!canSee) {
      notFound();
    }
    accepterCandidates = visible?.talleresCompatibles ?? [];
  }

  return (
    <section className="space-y-4">
      <Link href="/dashboard/incidencias" className="text-sm text-cyan-700 hover:underline">
        Volver a incidencias
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-2xl font-bold text-slate-900">Incidencia {incidencia.id}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p><span className="font-semibold">Teléfono:</span> {incidencia.telefono}</p>
          <p><span className="font-semibold">Estado:</span> {incidencia.estado}</p>
          <p><span className="font-semibold">Notificado:</span> {incidencia.notificado ? "Sí" : "No"}</p>
          <p><span className="font-semibold">Ubicación:</span> {incidencia.lat ?? "-"}, {incidencia.lng ?? "-"}</p>
          <p><span className="font-semibold">Creado:</span> {incidencia.creadoEn.toLocaleString()}</p>
          <p><span className="font-semibold">Actualizado:</span> {incidencia.actualizado.toLocaleString()}</p>
        </div>
        {incidencia.urlPdf ? (
          <p className="mt-3">
            <a
              href={incidencia.urlPdf}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
            >
              Ver PDF
            </a>
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <details>
          <summary className="cursor-pointer font-semibold text-slate-900">Datos JSON</summary>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(incidencia.datos, null, 2)}
          </pre>
        </details>
      </div>

      {incidencia.aceptacionIncidencia ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          Aceptada por <strong>{incidencia.aceptacionIncidencia.taller.nombre}</strong> el{" "}
          {incidencia.aceptacionIncidencia.aceptadoEn.toLocaleString()}.
          {!admin && acceptedByMine && incidencia.estado.toLowerCase() !== "completada" ? (
            <div className="mt-3">
              <IncidenciaActionButtons incidenciaId={incidencia.id} canClose />
            </div>
          ) : null}
        </div>
      ) : null}

      {!admin &&
      incidencia.aceptacionIncidencia === null &&
      isOpenAcceptanceState(incidencia.estado) &&
      accepterCandidates.length > 0 ? (
        <AcceptIncidenciaForm incidenciaId={incidencia.id} talleres={accepterCandidates} />
      ) : null}
    </section>
  );
}
