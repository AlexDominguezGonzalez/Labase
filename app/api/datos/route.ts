import type { NextRequest } from "next/server"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  accesoPermitido,
  clienteServidor,
  ErrorConfiguracion,
  mensajeSupabase,
  respuestaError,
  TABLA,
} from "@/lib/servidor/supabase"

const CAMPOS_ORDEN = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
]

/** Lectura paginada de lo que hay persistido en Supabase. */
export async function GET(req: NextRequest) {
  const bloqueo = accesoPermitido()
  if (bloqueo) return respuestaError(bloqueo, 403)

  const p = req.nextUrl.searchParams
  const ciudades = (p.get("ciudades") ?? "")
    .split(",")
    .filter((c) => NOMBRES_CIUDADES.includes(c))
  const desde = p.get("desde")
  const hasta = p.get("hasta")
  const orden = CAMPOS_ORDEN.includes(p.get("orden") ?? "")
    ? p.get("orden")!
    : "fecha_hora"
  const asc = p.get("dir") !== "desc"
  const pagina = Math.max(0, Number.parseInt(p.get("pagina") ?? "0", 10) || 0)
  const tam = Math.min(
    100,
    Math.max(1, Number.parseInt(p.get("tam") ?? "25", 10) || 25)
  )

  for (const f of [desde, hasta]) {
    if (f && Number.isNaN(Date.parse(f))) {
      return respuestaError("Fecha de filtro no válida.", 400)
    }
  }

  try {
    let consulta = clienteServidor()
      .from(TABLA)
      .select(
        "id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en",
        {
          count: "exact",
        }
      )
    if (ciudades.length > 0) consulta = consulta.in("ciudad", ciudades)
    if (desde) consulta = consulta.gte("fecha_hora", desde)
    if (hasta) consulta = consulta.lte("fecha_hora", hasta)
    // Sin ORDER BY la base de datos no garantiza ningún orden: siempre lo fijamos.
    consulta = consulta
      .order(orden, { ascending: asc })
      .order("ciudad", { ascending: true })
      .order("fecha_hora", { ascending: true })
      .range(pagina * tam, pagina * tam + tam - 1)

    const { data, error, count } = await consulta
    if (error) return respuestaError(mensajeSupabase(error), 502)
    return Response.json({ filas: data ?? [], total: count ?? 0, pagina, tam })
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return respuestaError(e.message, 500)
    console.error("Error inesperado en /api/datos:", (e as Error).message)
    return respuestaError("Error inesperado del servidor.", 500)
  }
}
