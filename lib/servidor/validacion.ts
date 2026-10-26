import { z } from "zod"

import { TAM_LOTE } from "@/lib/etl/carga"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"

/** Límite del cuerpo de la petición: 500 filas ≈ 70 KB; dejamos margen. */
export const MAX_BYTES_PETICION = 256 * 1024

const fechaUtc = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|\+00:00)$/,
    "fecha_hora debe ser ISO 8601 en UTC"
  )
  .refine((s) => !Number.isNaN(Date.parse(s)), "fecha_hora no válida")

const numeroFinito = z.number().finite()

export const esquemaFila = z
  .object({
    ciudad: z.enum(NOMBRES_CIUDADES as [string, ...string[]]),
    fecha_hora: fechaUtc,
    temperatura_c: numeroFinito,
    humedad_pct: numeroFinito.min(0).max(100),
    precipitacion_mm: numeroFinito.min(0),
  })
  .strict()

export const esquemaCarga = z.object({
  registros: z.array(esquemaFila).min(1).max(TAM_LOTE),
})

export const esquemaVerificacion = z.object({
  claves: z
    .array(
      z.object({ ciudad: z.string().min(1).max(100), fecha_hora: fechaUtc })
    )
    .min(1)
    .max(TAM_LOTE),
})

/** Lee el cuerpo respetando el límite de tamaño, aunque falte Content-Length. */
export async function leerJsonLimitado(
  req: Request
): Promise<
  { ok: true; datos: unknown } | { ok: false; error: string; estado: number }
> {
  const declarada = Number(req.headers.get("content-length") ?? "0")
  if (declarada > MAX_BYTES_PETICION) {
    return {
      ok: false,
      estado: 413,
      error: "La petición supera el tamaño máximo permitido.",
    }
  }
  const texto = await req.text()
  if (new TextEncoder().encode(texto).length > MAX_BYTES_PETICION) {
    return {
      ok: false,
      estado: 413,
      error: "La petición supera el tamaño máximo permitido.",
    }
  }
  try {
    return { ok: true, datos: JSON.parse(texto) }
  } catch {
    return { ok: false, estado: 400, error: "El cuerpo no es JSON válido." }
  }
}

export function describirErroresZod(e: z.ZodError, max = 5): string {
  return e.issues
    .slice(0, max)
    .map((i) => `${i.path.join(".") || "cuerpo"}: ${i.message}`)
    .join("; ")
}
