import Link from "next/link";
import { getAuthUserFromCookies, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleIncidenciasForUser } from "@/lib/incidencias-service";
import { MonthlyTimingChart } from "@/components/monthly-timing-chart";

type TimingSample = {
  tallerId: string;
  tallerNombre: string;
  acceptedAt: string;
  openToAcceptMinutes: number;
  acceptToCompleteMinutes: number | null;
};

function Card({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function completedState(estado: string) {
  const s = estado.toLowerCase();
  return [
    "completada",
    "completado",
    "finalizada",
    "finalizado",
    "cerrada",
    "cerrado",
    "resuelta",
    "resuelto",
  ].includes(s);
}


export default async function DashboardHomePage() {
  const user = await getAuthUserFromCookies();
  if (!user) return null;

  const admin = isAdminRole(user.rol);
  const [incidencias, talleresDisponibles] = await Promise.all([
    admin
      ? db.incidencia.findMany({
          include: {
            aceptacionIncidencia: {
              include: {
                taller: {
                  select: {
                    id: true,
                    nombre: true,
                  },
                },
              },
            },
          },
        })
      : getVisibleIncidenciasForUser(user, "all"),
    admin
      ? db.taller.findMany({
          select: { id: true, nombre: true },
          orderBy: { nombre: "asc" },
        })
      : Promise.resolve(
          user.talleres
            .map((t) => ({ id: t.id, nombre: t.nombre }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        ),
  ]);

  const total = incidencias.length;
  const pendientes = incidencias.filter((i) =>
    "aceptacionIncidencia" in i ? i.aceptacionIncidencia === null : i.aceptacion === null,
  ).length;
  const aceptadas = total - pendientes;
  const noNotificadas = incidencias.filter((i) => !i.notificado).length;
  const conPdf = incidencias.filter((i) => Boolean(i.urlPdf)).length;

  const timingSamples = incidencias
    .map((item) => {
      if ("aceptacionIncidencia" in item) {
        if (!item.aceptacionIncidencia) return null;
        const openToAccept =
          (item.aceptacionIncidencia.aceptadoEn.getTime() - item.creadoEn.getTime()) / 60000;
        const acceptToComplete = completedState(item.estado)
          ? (item.actualizado.getTime() - item.aceptacionIncidencia.aceptadoEn.getTime()) / 60000
          : null;
        return {
          tallerId: item.aceptacionIncidencia.taller.id,
          tallerNombre: item.aceptacionIncidencia.taller.nombre,
          acceptedAt: item.aceptacionIncidencia.aceptadoEn.toISOString(),
          openToAcceptMinutes: Math.max(0, openToAccept),
          acceptToCompleteMinutes:
            acceptToComplete !== null ? Math.max(0, acceptToComplete) : null,
        };
      }

      if (!item.aceptacion) return null;
      const openToAccept =
        (item.aceptacion.aceptadoEn.getTime() - item.creadoEn.getTime()) / 60000;
      const acceptToComplete = completedState(item.estado)
        ? (item.actualizado.getTime() - item.aceptacion.aceptadoEn.getTime()) / 60000
        : null;
      return {
        tallerId: item.aceptacion.tallerId,
        tallerNombre: item.aceptacion.tallerNombre,
        acceptedAt: item.aceptacion.aceptadoEn.toISOString(),
        openToAcceptMinutes: Math.max(0, openToAccept),
        acceptToCompleteMinutes:
          acceptToComplete !== null ? Math.max(0, acceptToComplete) : null,
      };
    })
    .filter((x): x is TimingSample => x !== null);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Resumen</h2>
        <p className="text-sm text-slate-600">
          Vista rapida de incidencias visibles y tiempos medios mensuales por taller.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card label="Total visibles" value={total} />
        <Card label="Pendientes visibles" value={pendientes} />
        <Card label="Aceptadas visibles" value={aceptadas} />
        <Card label="No notificadas visibles" value={noNotificadas} />
        <Card label="Con PDF visibles" value={conPdf} />
      </div>

      <MonthlyTimingChart samples={timingSamples} talleres={talleresDisponibles} />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-slate-900">Accesos rapidos</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800"
            href="/dashboard/incidencias"
          >
            Ver incidencias
          </Link>
          <Link
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            href="/dashboard/talleres"
          >
            Ver talleres
          </Link>
          {admin ? (
            <Link
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              href="/dashboard/usuarios"
            >
              Gestionar usuarios
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
