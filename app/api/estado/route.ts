import {
  accesoPermitido,
  clienteServidor,
  mensajeSupabase,
  TABLA,
  variablesQueFaltan,
} from "@/lib/servidor/supabase"

/** Indica si el destino está listo, sin revelar nunca valores de credenciales. */
export async function GET() {
  const bloqueo = accesoPermitido()
  if (bloqueo) return Response.json({ listo: false, mensaje: bloqueo })

  const faltan = variablesQueFaltan()
  if (faltan.length > 0) {
    return Response.json({
      listo: false,
      mensaje: `Faltan variables de entorno en el servidor: ${faltan.join(", ")}. Consulta .env.example.`,
    })
  }
  const { error, count } = await clienteServidor()
    .from(TABLA)
    // Sin head:true: una petición HEAD a una tabla inexistente devuelve 404
    // sin cuerpo y supabase-js no lo reporta como error.
    .select("id", { count: "exact" })
    .limit(1)
    .then(
      (r) => r,
      (e: Error) => ({
        error: { message: e.message, code: undefined },
        count: null,
      })
    )
  if (error)
    return Response.json({ listo: false, mensaje: mensajeSupabase(error) })
  return Response.json({
    listo: true,
    mensaje: `Conectado. La tabla contiene ${count ?? 0} filas.`,
    filas: count ?? 0,
  })
}
