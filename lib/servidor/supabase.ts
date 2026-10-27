import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const TABLA = "mediciones_meteorologicas"

/**
 * La URL del proyecto no es secreta, pero como todo el acceso se hace desde
 * el servidor aceptamos SUPABASE_URL y, por compatibilidad, la variante
 * NEXT_PUBLIC_SUPABASE_URL. La clave secreta se acepta como
 * SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY, y NUNCA debe llevar NEXT_PUBLIC.
 */
function configuracion() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  return { url, clave }
}

export function variablesQueFaltan(): string[] {
  const { url, clave } = configuracion()
  const faltan: string[] = []
  if (!url) faltan.push("SUPABASE_URL")
  if (!clave) faltan.push("SUPABASE_SERVICE_ROLE_KEY")
  return faltan
}

let cliente: SupabaseClient | null = null

export function clienteServidor(): SupabaseClient {
  const { url, clave } = configuracion()
  if (!url || !clave) {
    throw new ErrorConfiguracion(
      `Faltan variables de entorno: ${variablesQueFaltan().join(", ")}`
    )
  }
  cliente ??= createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cliente
}

export class ErrorConfiguracion extends Error {}

/**
 * Los endpoints quedan abiertos en desarrollo local. En producción solo se
 * permiten si proxy.ts está pidiendo usuario y contraseña (ACCESO_USUARIO y
 * ACCESO_CLAVE definidas) o si se habilitan de forma explícita porque hay otra
 * protección delante.
 */
export function accesoPermitido(): string | null {
  const protegido = Boolean(
    process.env.ACCESO_USUARIO && process.env.ACCESO_CLAVE
  )
  if (
    process.env.NODE_ENV === "production" &&
    !protegido &&
    process.env.ETL_PERMITIR_EN_PRODUCCION !== "true"
  ) {
    return "Endpoint deshabilitado en producción: define ACCESO_USUARIO y ACCESO_CLAVE para protegerlo con contraseña."
  }
  return null
}

export function respuestaError(mensaje: string, estado: number) {
  return Response.json({ error: mensaje }, { status: estado })
}

/** Traduce errores de PostgREST a algo comprensible sin filtrar secretos. */
export function mensajeSupabase(e: { message?: string; code?: string }) {
  if (e.code === "PGRST205" || e.code === "42P01") {
    return `La tabla «${TABLA}» no existe. Aplica la migración de supabase/migrations.`
  }
  return `Supabase: ${e.message ?? "error desconocido"}${e.code ? ` (código ${e.code})` : ""}`
}
