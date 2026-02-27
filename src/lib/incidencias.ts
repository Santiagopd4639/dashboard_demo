import { Prisma } from "@prisma/client";
import { haversineKm } from "@/lib/geo";

const AVERIA_KEYS = [
  "averia",
  "tipo_averia",
  "tipoaveria",
  "tipo-averia",
  "servicio",
  "tipo",
  "problema",
];

function normalize(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function walkJson(value: Prisma.JsonValue, collector: string[]) {
  if (typeof value === "string") {
    collector.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkJson(item as Prisma.JsonValue, collector);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = normalize(rawKey);
      if (AVERIA_KEYS.includes(key) && typeof rawValue === "string") {
        collector.push(rawValue);
      }
      walkJson(rawValue as Prisma.JsonValue, collector);
    }
  }
}

export function deduceAveriaType(data: Prisma.JsonValue): "pinchazo" | "desconocida" {
  const strings: string[] = [];
  walkJson(data, strings);
  const joined = normalize(strings.join(" "));
  if (joined.includes("pinchazo")) return "pinchazo";
  if (joined.includes("pinchado")) return "pinchazo";
  if (joined.includes("rueda")) return "pinchazo";
  if (joined.includes("neumatico")) return "pinchazo";
  if (joined.includes("llanta")) return "pinchazo";
  return "desconocida";
}

export function extractCapacidades(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? normalize(v) : ""))
    .filter(Boolean);
}

export function isCompatible(
  capacidades: Prisma.JsonValue,
  averia: "pinchazo" | "desconocida",
) {
  if (averia === "desconocida") return false;
  const caps = extractCapacidades(capacidades);
  return caps.includes(averia);
}

export function calculateDistanceKm(
  incidencia: { lat: number | null; lng: number | null },
  taller: { lat: number | null; lng: number | null },
) {
  if (
    incidencia.lat === null ||
    incidencia.lng === null ||
    taller.lat === null ||
    taller.lng === null
  ) {
    return null;
  }
  return haversineKm(incidencia.lat, incidencia.lng, taller.lat, taller.lng);
}
