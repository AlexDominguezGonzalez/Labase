import type { NextRequest } from "next/server"
import { z } from "zod"

import type { PuntoMapa } from "@/lib/mapa/tipos"
import {
  accesoPermitido,
  clienteServidor,
  ErrorConfiguracion,
  mensajeSupabase,
  respuestaError,
} from "@/lib/servidor/supabase"

const esquema = z.object({
  bbox: z
    .string()
    .transform((s) => s.split(",").map(Number))
    .pipe(
      z
        .tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ])
        .refine(([w, s, e, n]) => w < e && s < n, "Recuadro vacío.")
    ),
  hasta: z.string().datetime({ offset: true }).optional(),
})

/** Última medición de cada ciudad dentro del bounding box visible. */
export async function GET(req: NextRequest) {
  const bloqueo = accesoPermitido()
  if (bloqueo) return respuestaError(bloqueo, 403)

  const p = req.nextUrl.searchParams
  const parametros = esquema.safeParse({
    bbox: p.get("bbox") ?? "",
    hasta: p.get("hasta") ?? undefined,
  })
  if (!parametros.success) {
    return respuestaError("Parámetro bbox o hasta no válido.", 400)
  }
  const [min_lng, min_lat, max_lng, max_lat] = parametros.data.bbox

  try {
    const { data, error } = await clienteServidor().rpc(
      "ultimas_mediciones_en_bbox",
      {
        min_lng,
        min_lat,
        max_lng,
        max_lat,
        hasta: parametros.data.hasta ?? null,
      }
    )
    if (error) return respuestaError(mensajeSupabase(error), 502)
    return Response.json(
      { puntos: (data ?? []) as PuntoMapa[] },
      // Lo bastante corto para no ocultar cargas nuevas si no hay Realtime.
      { headers: { "Cache-Control": "private, max-age=10" } }
    )
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return respuestaError(e.message, 500)
    console.error("Error inesperado en /api/mapa:", (e as Error).message)
    return respuestaError("Error inesperado del servidor.", 500)
  }
}
