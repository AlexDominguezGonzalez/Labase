import type { RegistroTransformado, RespuestaOpenMeteo } from "./tipos"

export interface ResultadoTransformacion {
  registros: RegistroTransformado[]
  /** Problemas detectados a nivel de respuesta (no de fila). */
  avisos: string[]
}

// Open-Meteo con timeformat=iso8601 devuelve "AAAA-MM-DDTHH:MM" sin zona.
// Aceptamos también segundos y un sufijo Z/+00:00 explícito.
const PATRON_HORA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]00:00)?$/

/**
 * Interpreta una marca de tiempo como UTC de forma explícita.
 * Nunca se usa el huso horario del navegador: se construye con Date.UTC.
 */
export function interpretarFechaUtc(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = PATRON_HORA.exec(valor.trim())
  if (!m) return null
  const [, a, mes, d, h, min, s] = m
  const ms = Date.UTC(+a, +mes - 1, +d, +h, +min, s ? +s : 0)
  const fecha = new Date(ms)
  // Rechaza fechas imposibles (p. ej. 2026-09-31T25:00).
  if (
    fecha.getUTCFullYear() !== +a ||
    fecha.getUTCMonth() !== +mes - 1 ||
    fecha.getUTCDate() !== +d ||
    fecha.getUTCHours() !== +h ||
    fecha.getUTCMinutes() !== +min
  ) {
    return null
  }
  return fecha.toISOString()
}

const SERIES = [
  ["temperature_2m", "temperatura"],
  ["relative_humidity_2m", "humedad"],
  ["precipitation", "precipitacion"],
] as const

/**
 * Convierte los arrays paralelos de `hourly` en una fila por hora.
 * No convierte ni rellena valores: null, "" o ausente se conservan tal cual
 * para que la fase de limpieza decida (y explique) qué rechazar.
 */
export function transformarRespuesta(
  ciudad: string,
  json: RespuestaOpenMeteo
): ResultadoTransformacion {
  const avisos: string[] = []
  const hourly = json.hourly
  if (!hourly || typeof hourly !== "object") {
    return {
      registros: [],
      avisos: ["La respuesta no contiene el bloque «hourly»."],
    }
  }
  if (json.utc_offset_seconds !== undefined && json.utc_offset_seconds !== 0) {
    avisos.push(
      `La respuesta declara un desfase UTC de ${json.utc_offset_seconds} s; se esperaba 0.`
    )
  }

  const tiempos = Array.isArray(hourly.time) ? hourly.time : null
  if (!tiempos) avisos.push("Falta el array «time».")
  const series = SERIES.map(([clave]) => {
    const arr = hourly[clave]
    if (!Array.isArray(arr)) {
      avisos.push(`Falta el array «${clave}».`)
      return null
    }
    return arr
  })

  const longitudes = [tiempos, ...series].map((a) => a?.length ?? 0)
  const n = Math.max(...longitudes)
  const coherentes = longitudes.every((l) => l === n)
  if (!coherentes) {
    avisos.push(
      `Arrays de longitud incoherente: time=${longitudes[0]}, temperature_2m=${longitudes[1]}, relative_humidity_2m=${longitudes[2]}, precipitation=${longitudes[3]}.`
    )
  }

  const registros: RegistroTransformado[] = []
  for (let i = 0; i < n; i++) {
    const avisosFila: string[] = []
    const fechaOriginal = tiempos && i < tiempos.length ? tiempos[i] : undefined
    if (!tiempos || i >= tiempos.length)
      avisosFila.push("Sin posición en «time»")
    const valores = series.map((arr, k) => {
      if (!arr || i >= arr.length) {
        avisosFila.push(`Sin posición en «${SERIES[k][0]}»`)
        return undefined
      }
      return arr[i]
    })
    registros.push({
      id: `${ciudad}#${i}`,
      ciudad,
      indice: i,
      fecha_hora_original: fechaOriginal,
      fecha_hora: interpretarFechaUtc(fechaOriginal),
      temperatura_original: valores[0],
      humedad_original: valores[1],
      precipitacion_original: valores[2],
      avisos: avisosFila,
    })
  }
  return { registros, avisos }
}
