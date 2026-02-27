import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getAuthUserFromCookies, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleIncidenciasForUser } from "@/lib/incidencias-service";
import { deduceAveriaType } from "@/lib/incidencias";
import { IncidenciaActionButtons } from "@/components/incidencia-action-buttons";
import { AutoRefresh } from "@/components/auto-refresh";

type Search = {
  tab?: string;
  tallerId?: string;
  estado?: string;
  telefono?: string;
  from?: string;
  to?: string;
  notificado?: string;
  conPdf?: string;
  conUbicacion?: string;
};

function normalizeEstado(estado: string) {
  return estado.trim().toLowerCase().replaceAll("_", " ");
}

function isOpenAcceptanceState(estado: string) {
  const normalized = normalizeEstado(estado);
  return normalized === "aceptacion" || normalized === "en aceptacion" || normalized === "pendiente";
}

function parseDate(value?: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

export default async function IncidenciasPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const user = await getAuthUserFromCookies();
  if (!user) return null;
  const admin = isAdminRole(user.rol);

  if (!admin) {
    const scope =
      params.tab === "accepted"
        ? "acceptedByMine"
        : params.tab === "closed"
          ? "closedByMine"
          : "openForAcceptance";
    const incidencias = await getVisibleIncidenciasForUser(
      user,
      scope,
      params.tallerId || undefined,
    );

    return (
      <section className="space-y-4">
        <AutoRefresh intervalMs={5000} />
        <header>
          <h2 className="text-2xl font-bold text-slate-900">Incidencias</h2>
          <p className="text-sm text-slate-600">
            En aceptacion por radio y aceptadas/completadas por mi taller.
          </p>
        </header>

        <div className="flex gap-2">
          <Link
            href="/dashboard/incidencias?tab=pending"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              scope === "openForAcceptance"
                ? "bg-cyan-700 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            En aceptacion
          </Link>
          <Link
            href="/dashboard/incidencias?tab=accepted"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              scope === "acceptedByMine"
                ? "bg-cyan-700 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            Aceptadas por mi taller
          </Link>
          <Link
            href="/dashboard/incidencias?tab=closed"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              scope === "closedByMine"
                ? "bg-cyan-700 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            Cerradas por mi taller
          </Link>
        </div>

        <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
          <input
            type="hidden"
            name="tab"
            value={
              scope === "acceptedByMine"
                ? "accepted"
                : scope === "closedByMine"
                  ? "closed"
                  : "pending"
            }
          />
          <select name="tallerId" defaultValue={params.tallerId ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos mis talleres</option>
            {user.talleres.map((taller) => (
              <option key={taller.id} value={taller.id}>
                {taller.nombre}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800">
            Filtrar
          </button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Averia</th>
                <th className="px-3 py-2">Distancia</th>
                <th className="px-3 py-2">Compatibilidad</th>
                <th className="px-3 py-2">PDF</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {incidencias.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link className="text-cyan-700 hover:underline" href={`/dashboard/incidencias/${i.id}`}>
                      {i.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-3 py-2">{i.telefono}</td>
                  <td className="px-3 py-2">{i.estado}</td>
                  <td className="px-3 py-2">{i.averiaDetectada}</td>
                  <td className="px-3 py-2">{i.distanciaKm !== null ? `${i.distanciaKm} km` : "-"}</td>
                  <td className="px-3 py-2">
                    {i.compatible ? (
                      <Badge label="Compatible" className="bg-emerald-100 text-emerald-800" />
                    ) : (
                      <Badge label="No compatible" className="bg-red-100 text-red-700" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {i.urlPdf ? (
                      <a href={i.urlPdf} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">
                        Ver PDF
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {i.aceptable && isOpenAcceptanceState(i.estado) ? (
                      <IncidenciaActionButtons
                        incidenciaId={i.id}
                        canAccept
                        acceptTallerId={i.talleresCompatibles[0]?.id}
                      />
                    ) : i.aceptacion ? (
                      <div className="space-y-2 text-xs text-slate-600">
                        <p>
                          {i.estado.toLowerCase() === "completada" ? "Cerrada" : "Aceptada"} por{" "}
                          {i.aceptacion.tallerNombre}
                        </p>
                        {i.estado.toLowerCase() === "aceptada" && i.aceptadaPorMisTalleres ? (
                          <IncidenciaActionButtons incidenciaId={i.id} canClose />
                        ) : null}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {incidencias.length === 0 ? <p className="p-4 text-sm text-slate-500">Sin incidencias en esta vista.</p> : null}
        </div>
      </section>
    );
  }

  const where: Prisma.IncidenciaWhereInput = {};
  const tab = params.tab ?? "all";
  if (tab === "pending") where.estado = { in: ["aceptacion", "en_aceptacion", "pendiente"] };
  if (tab === "accepted") where.estado = { in: ["aceptada", "completada"] };

  if (params.estado) where.estado = params.estado;
  if (params.telefono) where.telefono = { contains: params.telefono, mode: "insensitive" };

  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  if (from || to) {
    where.creadoEn = {};
    if (from) where.creadoEn.gte = from;
    if (to) where.creadoEn.lte = to;
  }

  if (params.notificado === "true") where.notificado = true;
  if (params.notificado === "false") where.notificado = false;
  if (params.conPdf === "true") where.urlPdf = { not: null };
  if (params.conUbicacion === "true") {
    where.lat = { not: null };
    where.lng = { not: null };
  }
  if (params.tallerId) where.idTaller = params.tallerId;

  const [talleres, incidencias] = await Promise.all([
    db.taller.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    db.incidencia.findMany({
      where,
      include: {
        aceptacionIncidencia: {
          include: {
            taller: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { creadoEn: "desc" },
      take: 200,
    }),
  ]);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Incidencias</h2>
        <p className="text-sm text-slate-600">Vista de administracion con filtros.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/incidencias?tab=all" className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "all" ? "bg-cyan-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>Todas</Link>
        <Link href="/dashboard/incidencias?tab=pending" className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "pending" ? "bg-cyan-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>En aceptacion</Link>
        <Link href="/dashboard/incidencias?tab=accepted" className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "accepted" ? "bg-cyan-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>Aceptadas/Completadas</Link>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input type="hidden" name="tab" value={tab} />
        <select name="tallerId" defaultValue={params.tallerId ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Taller (todos)</option>
          {talleres.map((taller) => (
            <option key={taller.id} value={taller.id}>
              {taller.nombre}
            </option>
          ))}
        </select>
        <input name="estado" defaultValue={params.estado ?? ""} placeholder="Estado" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="telefono" defaultValue={params.telefono ?? ""} placeholder="Telefono" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" name="from" defaultValue={params.from ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={params.to ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="notificado" defaultValue={params.notificado ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Notificado (todos)</option>
          <option value="true">Si</option>
          <option value="false">No</option>
        </select>
        <select name="conPdf" defaultValue={params.conPdf ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">PDF (todos)</option>
          <option value="true">Con PDF</option>
        </select>
        <select name="conUbicacion" defaultValue={params.conUbicacion ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Ubicacion (todas)</option>
          <option value="true">Con ubicacion</option>
        </select>
        <button type="submit" className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800">Aplicar filtros</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Telefono</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Averia detectada</th>
              <th className="px-3 py-2">Notificado</th>
              <th className="px-3 py-2">Aceptacion</th>
              <th className="px-3 py-2">PDF</th>
            </tr>
          </thead>
          <tbody>
            {incidencias.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link className="text-cyan-700 hover:underline" href={`/dashboard/incidencias/${i.id}`}>
                    {i.id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="px-3 py-2">{i.telefono}</td>
                <td className="px-3 py-2">{i.estado}</td>
                <td className="px-3 py-2">{deduceAveriaType(i.datos)}</td>
                <td className="px-3 py-2">{i.notificado ? "Si" : "No"}</td>
                <td className="px-3 py-2">
                  {i.aceptacionIncidencia
                    ? `${i.aceptacionIncidencia.taller.nombre} (${i.aceptacionIncidencia.aceptadoEn.toLocaleString()})`
                    : "Sin aceptar"}
                </td>
                <td className="px-3 py-2">
                  {i.urlPdf ? (
                    <a href={i.urlPdf} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">
                      Ver PDF
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidencias.length === 0 ? <p className="p-4 text-sm text-slate-500">Sin resultados.</p> : null}
      </div>
    </section>
  );
}
