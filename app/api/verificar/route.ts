import {
  accesoPermitido,
  clienteServidor,
  ErrorConfiguracion,
  mensajeSupabase,
  respuestaError,
  TABLA,
} from "@/lib/servidor/supabase"
import {
  describirErroresZod,
  esquemaVerificacion,
  leerJsonLimitado,
} from "@/lib/servidor/validacion"

const TAM_CONSULTA = 100

/** Comprueba qué claves (ciudad, fecha_hora) existen realmente en destino. */
export async function POST(req: Request) {
  const bloqueo = accesoPermitido()
  if (bloqueo) return respuestaError(bloqueo, 403)

  const cuerpo = await leerJsonLimitado(req)
  if (!cuerpo.ok) return respuestaError(cuerpo.error, cuerpo.estado)
  const validacion = esquemaVerificacion.safeParse(cuerpo.datos)
  if (!validacion.success) {
    return respuestaError(describirErroresZod(validacion.error), 422)
  }

  const porCiudad = new Map<string, string[]>()
  for (const c of validacion.data.claves) {
    const iso = new Date(c.fecha_hora).toISOString()
    porCiudad.set(c.ciudad, [...(porCiudad.get(c.ciudad) ?? []), iso])
  }

  try {
    const supabase = clienteServidor()
    const encontradas = new Set<string>()
    for (const [ciudad, fechas] of porCiudad) {
      for (let i = 0; i < fechas.length; i += TAM_CONSULTA) {
        const trozo = fechas.slice(i, i + TAM_CONSULTA)
        const { data, error } = await supabase
          .from(TABLA)
          .select("ciudad, fecha_hora")
          .eq("ciudad", ciudad)
          .in("fecha_hora", trozo)
        if (error) return respuestaError(mensajeSupabase(error), 502)
        for (const fila of data ?? []) {
          encontradas.add(
            `${fila.ciudad}|${new Date(fila.fecha_hora).toISOString()}`
          )
        }
      }
    }
    const faltan = validacion.data.claves.filter(
      (c) =>
        !encontradas.has(`${c.ciudad}|${new Date(c.fecha_hora).toISOString()}`)
    )
    return Response.json({
      comprobadas: validacion.data.claves.length,
      encontradas: validacion.data.claves.length - faltan.length,
      faltan,
    })
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return respuestaError(e.message, 500)
    console.error("Error inesperado en /api/verificar:", (e as Error).message)
    return respuestaError("Error inesperado del servidor.", 500)
  }
}
