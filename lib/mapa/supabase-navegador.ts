import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Cliente del navegador SOLO para escuchar el canal público de Broadcast.
 * Usa la clave publicable (anon), que no tiene permisos sobre ninguna tabla:
 * las lecturas siguen pasando por los Route Handlers con la clave de servicio.
 * Si faltan las variables, el mapa funciona igual pero sin tiempo real.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let cliente: SupabaseClient | null = null

export function clienteTiempoReal(): SupabaseClient | null {
  if (!URL || !CLAVE) return null
  cliente ??= createClient(URL, CLAVE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cliente
}
