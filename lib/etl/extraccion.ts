import type { Ciudad, RespuestaOpenMeteo } from "./tipos"

export const URL_ARCHIVO = "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const
export const MAX_DIAS = 31
export const FECHA_INICIAL_DEFECTO = "2026-09-01"
export const FECHA_FINAL_DEFECTO = "2026-09-30"

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Convierte "AAAA-MM-DD" en milisegundos UTC, o null si no es una fecha real. */
export function fechaUtc(fecha: string): number | null {
  if (!PATRON_FECHA.test(fecha)) return null
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  // Evita fechas como 2026-02-31, que Date.parse "corrige" en silencio.
  if (new Date(ms).toISOString().slice(0, 10) !== fecha) return null
  return ms
}

/** Días incluidos en el intervalo (ambos extremos cuentan). */
export function diasEntre(inicio: string, fin: string): number | null {
  const a = fechaUtc(inicio)
  const b = fechaUtc(fin)
  if (a === null || b === null) return null
  return Math.round((b - a) / 86_400_000) + 1
}

export interface ValidacionExtraccion {
  errores: string[]
  dias: number
  registrosPrevistos: number
}

export function validarConfiguracion(
  ciudades: string[],
  inicio: string,
  fin: string,
  hoy: Date = new Date()
): ValidacionExtraccion {
  const errores: string[] = []
  if (ciudades.length === 0) errores.push("Selecciona al menos una ciudad.")
  const a = fechaUtc(inicio)
  const b = fechaUtc(fin)
  if (a === null) errores.push("La fecha inicial no es válida.")
  if (b === null) errores.push("La fecha final no es válida.")
  let dias = 0
  if (a !== null && b !== null) {
    dias = Math.round((b - a) / 86_400_000) + 1
    if (b < a) {
      errores.push("La fecha final debe ser igual o posterior a la inicial.")
      dias = 0
    } else if (dias > MAX_DIAS) {
      errores.push(
        `El intervalo tiene ${dias} días; el máximo por extracción es ${MAX_DIAS}.`
      )
    }
    const hoyUtc = Date.UTC(
      hoy.getUTCFullYear(),
      hoy.getUTCMonth(),
      hoy.getUTCDate()
    )
    if (b >= hoyUtc) {
      errores.push(
        "La API histórica solo ofrece días pasados: la fecha final debe ser anterior a hoy."
      )
    }
  }
  return {
    errores,
    dias,
    registrosPrevistos: Math.max(dias, 0) * 24 * ciudades.length,
  }
}

export function construirUrl(ciudad: Ciudad, inicio: string, fin: string) {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "UTC",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  })
  return `${URL_ARCHIVO}?${params.toString()}`
}

/** Descarga una ciudad. Lanza un Error con un mensaje en castellano si falla. */
export async function descargarCiudad(
  url: string,
  signal?: AbortSignal
): Promise<RespuestaOpenMeteo> {
  let respuesta: Response
  try {
    respuesta = await fetch(url, { signal })
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e
    throw new Error(`Error de red al contactar con Open-Meteo: ${String(e)}`)
  }
  const texto = await respuesta.text()
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new Error(
      `Respuesta no JSON (HTTP ${respuesta.status}): ${texto.slice(0, 200)}`
    )
  }
  if (!respuesta.ok) {
    const razon =
      typeof json === "object" && json && "reason" in json
        ? String((json as { reason: unknown }).reason)
        : texto.slice(0, 200)
    throw new Error(`Open-Meteo respondió HTTP ${respuesta.status}: ${razon}`)
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("La respuesta no es un objeto JSON.")
  }
  return json as RespuestaOpenMeteo
}
