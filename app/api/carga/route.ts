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
  esquemaCarga,
  leerJsonLimitado,
} from "@/lib/servidor/validacion"

/** Recibe UN lote (≤ 500 filas), lo valida y hace upsert por (ciudad, fecha_hora). */
export async function POST(req: Request) {
  const bloqueo = accesoPermitido()
  if (bloqueo) return respuestaError(bloqueo, 403)

  const cuerpo = await leerJsonLimitado(req)
  if (!cuerpo.ok) return respuestaError(cuerpo.error, cuerpo.estado)

  const validacion = esquemaCarga.safeParse(cuerpo.datos)
  if (!validacion.success) {
    return respuestaError(
      `Registros no válidos: ${describirErroresZod(validacion.error)}`,
      422
    )
  }
  const { registros } = validacion.data

  // El lote no puede contener dos veces la misma clave: PostgreSQL rechazaría
  // el upsert completo ("cannot affect row a second time").
  const claves = new Set(
    registros.map((r) => `${r.ciudad}|${new Date(r.fecha_hora).toISOString()}`)
  )
  if (claves.size !== registros.length) {
    return respuestaError(
      "El lote contiene claves (ciudad, fecha_hora) repetidas.",
      422
    )
  }

  try {
    const importadoEn = new Date().toISOString()
    const { data, error } = await clienteServidor()
      .from(TABLA)
      .upsert(
        registros.map((r) => ({ ...r, importado_en: importadoEn })),
        { onConflict: "ciudad,fecha_hora" }
      )
      .select("ciudad, fecha_hora")
    if (error) return respuestaError(mensajeSupabase(error), 502)
    // PostgREST devuelve las filas escritas, sin distinguir insertadas de
    // actualizadas: por eso solo informamos de «procesadas».
    return Response.json({ procesadas: data?.length ?? 0 })
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return respuestaError(e.message, 500)
    console.error("Error inesperado en /api/carga:", (e as Error).message)
    return respuestaError("Error inesperado del servidor.", 500)
  }
}
