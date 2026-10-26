import type {
  RegistroRechazado,
  RegistroTransformado,
  RegistroValido,
  ResultadoLimpieza,
} from "./tipos"

export const MOTIVO_DUPLICADO =
  "Duplicado de (ciudad, fecha_hora): se conserva la primera aparición válida"

/** Describe por qué un valor no es un número finito, o null si lo es. */
function problemaNumerico(nombre: string, v: unknown): string | null {
  if (v === undefined) return `${nombre}: valor ausente`
  if (v === null) return `${nombre}: valor nulo`
  if (typeof v === "string" && v.trim() === "") return `${nombre}: cadena vacía`
  // Open-Meteo devuelve números JSON. No convertimos cadenas: un "12" textual
  // indica un formato inesperado y se rechaza para que sea visible.
  if (typeof v !== "number") return `${nombre}: tipo ${typeof v}, no numérico`
  if (!Number.isFinite(v)) return `${nombre}: número no finito`
  return null
}

export function validarRegistro(r: RegistroTransformado): string[] {
  const motivos: string[] = [...r.avisos]
  if (typeof r.ciudad !== "string" || r.ciudad.trim() === "") {
    motivos.push("Sin ciudad")
  }
  if (r.fecha_hora === null) {
    motivos.push(
      r.fecha_hora_original === undefined || r.fecha_hora_original === null
        ? "Sin fecha_hora"
        : `fecha_hora no válida: ${JSON.stringify(r.fecha_hora_original)}`
    )
  }
  const t = problemaNumerico("Temperatura", r.temperatura_original)
  const h = problemaNumerico("Humedad", r.humedad_original)
  const p = problemaNumerico("Precipitación", r.precipitacion_original)
  if (t) motivos.push(t)
  if (h) motivos.push(h)
  else {
    const hum = r.humedad_original as number
    if (hum < 0 || hum > 100) motivos.push(`Humedad fuera de 0–100 %: ${hum}`)
  }
  if (p) motivos.push(p)
  else {
    const pre = r.precipitacion_original as number
    if (pre < 0) motivos.push(`Precipitación negativa: ${pre} mm`)
  }
  // Sin umbrales arbitrarios de temperatura: un valor extremo pero finito
  // puede ser real y debe conservarse.
  return [...new Set(motivos)]
}

/**
 * Valida cada fila y elimina duplicados por (ciudad, fecha_hora).
 * Regla de duplicados: se conserva la PRIMERA fila válida en el orden de
 * llegada (orden de ciudades extraídas y, dentro de cada una, índice del
 * array). Las siguientes se rechazan con el motivo MOTIVO_DUPLICADO.
 */
export function limpiar(registros: RegistroTransformado[]): ResultadoLimpieza {
  const validos: RegistroValido[] = []
  const rechazados: RegistroRechazado[] = []
  const vistos = new Map<string, string>()
  let duplicadosEliminados = 0

  for (const r of registros) {
    const motivos = validarRegistro(r)
    if (motivos.length > 0) {
      rechazados.push({ registro: r, motivos })
      continue
    }
    const clave = claveRegistro(r.ciudad, r.fecha_hora!)
    const previo = vistos.get(clave)
    if (previo) {
      duplicadosEliminados++
      rechazados.push({
        registro: r,
        motivos: [`${MOTIVO_DUPLICADO} (${previo})`],
      })
      continue
    }
    vistos.set(clave, r.id)
    validos.push({
      // La clave natural es única tras la deduplicación y estable entre
      // reintentos: la selección del usuario sigue apuntando al mismo registro.
      id: clave,
      ciudad: r.ciudad,
      fecha_hora: r.fecha_hora!,
      temperatura_c: r.temperatura_original as number,
      humedad_pct: r.humedad_original as number,
      precipitacion_mm: r.precipitacion_original as number,
    })
  }
  return { validos, rechazados, duplicadosEliminados }
}

export function claveRegistro(ciudad: string, fechaHoraIso: string) {
  return `${ciudad}|${new Date(fechaHoraIso).toISOString()}`
}
