import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleIncidenciasForUser } from "@/lib/incidencias-service";
import { jsonError } from "@/lib/http";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);

  const incidencia = await db.incidencia.findUnique({
    where: { id },
    include: {
      aceptacionIncidencia: {
        include: {
          taller: {
            select: { id: true, nombre: true },
          },
        },
      },
    },
  });

  if (!incidencia) return jsonError("Incidencia no encontrada", 404);
  if (isAdminRole(user.rol)) {
    return NextResponse.json({ incidencia });
  }

  const visibles = await getVisibleIncidenciasForUser(user, "all");
  const canSee = visibles.some((item) => item.id === incidencia.id);
  const acceptedByMine =
    incidencia.aceptacionIncidencia !== null &&
    user.talleres.some((t) => t.id === incidencia.aceptacionIncidencia?.tallerId);

  if (!canSee && !acceptedByMine) {
    return jsonError("Sin permiso para ver esta incidencia", 403);
  }

  return NextResponse.json({ incidencia });
}
