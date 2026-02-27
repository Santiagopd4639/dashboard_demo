import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthUserFromRequest, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleIncidenciasForUser } from "@/lib/incidencias-service";
import { jsonError } from "@/lib/http";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tab: z.enum(["all", "pending", "accepted", "closed"]).optional(),
  estado: z.string().optional(),
  telefono: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  notificado: z.enum(["true", "false"]).optional(),
  conPdf: z.enum(["true", "false"]).optional(),
  conUbicacion: z.enum(["true", "false"]).optional(),
  tallerId: z.string().uuid().optional(),
});

function parseDate(value?: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return jsonError("Parámetros inválidos", 400);

  const { page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;
  const admin = isAdminRole(user.rol);

  if (!admin) {
    const scope =
      parsed.data.tab === "accepted"
        ? "acceptedByMine"
        : parsed.data.tab === "closed"
          ? "closedByMine"
          : "openForAcceptance";
    const data = await getVisibleIncidenciasForUser(user, scope, parsed.data.tallerId);
    const paginated = data.slice(skip, skip + pageSize);
    return NextResponse.json({
      page,
      pageSize,
      total: data.length,
      items: paginated,
    });
  }

  const where: Prisma.IncidenciaWhereInput = {};

  if (parsed.data.tab === "pending") {
    where.estado = { in: ["aceptacion", "en_aceptacion", "pendiente"] };
  }
  if (parsed.data.tab === "accepted") where.estado = { in: ["aceptada", "completada"] };
  if (parsed.data.estado) where.estado = parsed.data.estado;
  if (parsed.data.telefono) {
    where.telefono = { contains: parsed.data.telefono, mode: "insensitive" };
  }

  const from = parseDate(parsed.data.from);
  const to = parseDate(parsed.data.to, true);
  if (from || to) {
    where.creadoEn = {};
    if (from) where.creadoEn.gte = from;
    if (to) where.creadoEn.lte = to;
  }

  if (parsed.data.notificado) where.notificado = parsed.data.notificado === "true";
  if (parsed.data.conPdf) {
    where.urlPdf = parsed.data.conPdf === "true" ? { not: null } : null;
  }
  if (parsed.data.conUbicacion) {
    if (parsed.data.conUbicacion === "true") {
      where.lat = { not: null };
      where.lng = { not: null };
    } else {
      where.OR = [{ lat: null }, { lng: null }];
    }
  }

  if (parsed.data.tallerId) where.idTaller = parsed.data.tallerId;

  const [items, total] = await Promise.all([
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
      skip,
      take: pageSize,
    }),
    db.incidencia.count({ where }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    items,
  });
}
