import { AuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateDistanceKm, deduceAveriaType, isCompatible } from "@/lib/incidencias";

export type UserIncidenciaView = {
  id: string;
  telefono: string;
  estado: string;
  datos: unknown;
  urlPdf: string | null;
  lat: number | null;
  lng: number | null;
  notificado: boolean;
  creadoEn: Date;
  actualizado: Date;
  completadoEn: Date | null;
  idTaller: string | null;
  aceptacion: {
    id: string;
    tallerId: string;
    tallerNombre: string;
    aceptadoEn: Date;
  } | null;
  averiaDetectada: "pinchazo" | "desconocida";
  compatible: boolean;
  distanciaKm: number | null;
  talleresCompatibles: {
    id: string;
    nombre: string;
    distanciaKm: number;
  }[];
  aceptable: boolean;
  aceptadaPorMisTalleres: boolean;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeEstado(estado: string) {
  return estado.trim().toLowerCase();
}

function isOpenAcceptanceState(estado: string) {
  const normalized = normalizeEstado(estado).replaceAll("_", " ");
  return normalized === "aceptacion" || normalized === "en aceptacion" || normalized === "pendiente";
}

export async function getVisibleIncidenciasForUser(
  user: AuthUser,
  scope: "openForAcceptance" | "acceptedByMine" | "closedByMine" | "all" = "openForAcceptance",
  tallerId?: string,
) {
  const assignedTallerIds = new Set(user.talleres.map((t) => t.id));
  if (tallerId && !assignedTallerIds.has(tallerId)) {
    return [];
  }

  const activeTalleres = user.talleres.filter((t) => t.activo);
  const incidencias = await db.incidencia.findMany({
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
    orderBy: {
      creadoEn: "desc",
    },
  });

  const mapped = incidencias.map<UserIncidenciaView>((incidencia) => {
    const averiaDetectada = deduceAveriaType(incidencia.datos);
    const compatibles = activeTalleres
      .map((taller) => {
        const compatible = isCompatible(taller.capacidades, averiaDetectada);
        const distanciaKm = calculateDistanceKm(incidencia, taller);
        if (!compatible || distanciaKm === null || distanciaKm > taller.radioKm) {
          return null;
        }
        return {
          id: taller.id,
          nombre: taller.nombre,
          distanciaKm: round2(distanciaKm),
        };
      })
      .filter((v): v is { id: string; nombre: string; distanciaKm: number } => Boolean(v))
      .sort((a, b) => a.distanciaKm - b.distanciaKm);

    const minDistance = compatibles.length > 0 ? compatibles[0].distanciaKm : null;
    const compatible = compatibles.length > 0;
    const acceptedByMine =
      incidencia.aceptacionIncidencia !== null &&
      assignedTallerIds.has(incidencia.aceptacionIncidencia.tallerId);
    const isOpenForAcceptance =
      isOpenAcceptanceState(incidencia.estado) && incidencia.aceptacionIncidencia === null;

    return {
      id: incidencia.id,
      telefono: incidencia.telefono,
      estado: incidencia.estado,
      datos: incidencia.datos,
      urlPdf: incidencia.urlPdf,
      lat: incidencia.lat,
      lng: incidencia.lng,
      notificado: incidencia.notificado,
      creadoEn: incidencia.creadoEn,
      actualizado: incidencia.actualizado,
      completadoEn: incidencia.completadoEn,
      idTaller: incidencia.idTaller,
      aceptacion: incidencia.aceptacionIncidencia
        ? {
            id: incidencia.aceptacionIncidencia.id,
            tallerId: incidencia.aceptacionIncidencia.tallerId,
            tallerNombre: incidencia.aceptacionIncidencia.taller.nombre,
            aceptadoEn: incidencia.aceptacionIncidencia.aceptadoEn,
          }
        : null,
      averiaDetectada,
      compatible,
      distanciaKm: minDistance,
      talleresCompatibles: compatibles,
      aceptable: isOpenForAcceptance && compatible,
      aceptadaPorMisTalleres: acceptedByMine,
    };
  });

  const filtered = mapped.filter((item) => {
    const estado = normalizeEstado(item.estado);
    const openAndVisibleByRadio =
      isOpenAcceptanceState(item.estado) &&
      item.aceptable &&
      (!tallerId || item.talleresCompatibles.some((t) => t.id === tallerId));
    const acceptedOrCompletedByMine =
      (estado === "aceptada" || estado === "completada") &&
      item.aceptadaPorMisTalleres &&
      item.aceptacion !== null &&
      (!tallerId || item.aceptacion.tallerId === tallerId);
    const acceptedByMine =
      estado === "aceptada" &&
      item.aceptadaPorMisTalleres &&
      item.aceptacion !== null &&
      (!tallerId || item.aceptacion.tallerId === tallerId);
    const closedByMine =
      estado === "completada" &&
      item.aceptadaPorMisTalleres &&
      item.aceptacion !== null &&
      (!tallerId || item.aceptacion.tallerId === tallerId);

    if (scope === "openForAcceptance") return openAndVisibleByRadio;
    if (scope === "acceptedByMine") return acceptedByMine;
    if (scope === "closedByMine") return closedByMine;
    return openAndVisibleByRadio || acceptedOrCompletedByMine;
  });

  if (scope === "openForAcceptance") {
    filtered.sort((a, b) => {
      const da = a.distanciaKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanciaKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }

  return filtered;
}
