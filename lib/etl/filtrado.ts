import type { FilaCarga, RegistroValido } from "./tipos"

export interface Filtros {
  /** Ciudades incluidas. Un array vacío significa «ninguna». */
  ciudades: string[]
  /** "AAAA-MM-DDTHH:MM" interpretado como UTC; "" = sin límite. */
  desde: string
  hasta: string
  tempMin: string
  tempMax: string
  humMin: string
  humMax: string
  precMin: string
  precMax: string
  soloLluvia: boolean
}

export type CampoOrden =
  "ciudad" | "fecha_hora" | "temperatura_c" | "humedad_pct" | "precipitacion_mm"

export interface Orden {
  campo: CampoOrden
  direccion: "asc" | "desc"
}

export const ORDEN_DEFECTO: Orden = { campo: "fecha_hora", direccion: "asc" }

export function filtrosIniciales(ciudades: string[]): Filtros {
  return {
    ciudades,
    desde: "",
    hasta: "",
    tempMin: "",
    tempMax: "",
    humMin: "",
    humMax: "",
    precMin: "",
    precMax: "",
    soloLluvia: false,
  }
}

/** "" → sin límite; texto no numérico → error. Acepta coma decimal. */
export function leerLimite(texto: string): number | null | "invalido" {
  const t = texto.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : "invalido"
}

export function leerFechaHoraUtc(texto: string): number | null | "invalido" {
  if (texto.trim() === "") return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(texto)
  if (!m) return "invalido"
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
}

export function erroresFiltros(f: Filtros): string[] {
  const errores: string[] = []
  const pares: [string, string, string][] = [
    ["Temperatura", f.tempMin, f.tempMax],
    ["Humedad", f.humMin, f.humMax],
    ["Precipitación", f.precMin, f.precMax],
  ]
  for (const [nombre, a, b] of pares) {
    const min = leerLimite(a)
    const max = leerLimite(b)
    if (min === "invalido" || max === "invalido") {
      errores.push(`${nombre}: introduce un número válido.`)
    } else if (min !== null && max !== null && min > max) {
      errores.push(`${nombre}: el mínimo es mayor que el máximo.`)
    }
  }
  const d = leerFechaHoraUtc(f.desde)
  const h = leerFechaHoraUtc(f.hasta)
  if (d === "invalido" || h === "invalido") errores.push("Fecha no válida.")
  else if (d !== null && h !== null && d > h)
    errores.push("La fecha «desde» es posterior a «hasta».")
  return errores
}

function dentro(v: number, min: string, max: string) {
  const a = leerLimite(min)
  const b = leerLimite(max)
  if (typeof a === "number" && v < a) return false
  if (typeof b === "number" && v > b) return false
  return true
}

/** Paso 1: filtros sobre TODOS los registros válidos (antes de paginar). */
export function aplicarFiltros(
  registros: RegistroValido[],
  f: Filtros
): RegistroValido[] {
  const ciudades = new Set(f.ciudades)
  const desde = leerFechaHoraUtc(f.desde)
  const hasta = leerFechaHoraUtc(f.hasta)
  return registros.filter((r) => {
    if (!ciudades.has(r.ciudad)) return false
    const t = Date.parse(r.fecha_hora)
    if (typeof desde === "number" && t < desde) return false
    if (typeof hasta === "number" && t > hasta) return false
    if (!dentro(r.temperatura_c, f.tempMin, f.tempMax)) return false
    if (!dentro(r.humedad_pct, f.humMin, f.humMax)) return false
    if (!dentro(r.precipitacion_mm, f.precMin, f.precMax)) return false
    if (f.soloLluvia && !(r.precipitacion_mm > 0)) return false
    return true
  })
}

/** Paso 2: ordenación estable (desempate por ciudad y fecha). */
export function ordenar(
  registros: RegistroValido[],
  o: Orden
): RegistroValido[] {
  const signo = o.direccion === "asc" ? 1 : -1
  const comparar = (a: RegistroValido, b: RegistroValido, c: CampoOrden) => {
    if (c === "ciudad") return a.ciudad.localeCompare(b.ciudad, "es")
    if (c === "fecha_hora")
      return Date.parse(a.fecha_hora) - Date.parse(b.fecha_hora)
    return a[c] - b[c]
  }
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, o.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

/** Paso 3: de lo filtrado y ordenado, solo lo seleccionado (mismo orden). */
export function conjuntoDeCarga(
  ordenados: RegistroValido[],
  seleccion: ReadonlySet<string>
): RegistroValido[] {
  return ordenados.filter((r) => seleccion.has(r.id))
}

/** Seleccionados que ya no cumplen los filtros actuales (no se subirán). */
export function seleccionFueraDeFiltros(
  filtrados: RegistroValido[],
  seleccion: ReadonlySet<string>
): number {
  let dentroDeFiltro = 0
  for (const r of filtrados) if (seleccion.has(r.id)) dentroDeFiltro++
  return seleccion.size - dentroDeFiltro
}

export function aFilaCarga(r: RegistroValido): FilaCarga {
  return {
    ciudad: r.ciudad,
    fecha_hora: r.fecha_hora,
    temperatura_c: r.temperatura_c,
    humedad_pct: r.humedad_pct,
    precipitacion_mm: r.precipitacion_mm,
  }
}

export function paginar<T>(filas: T[], pagina: number, tam: number): T[] {
  return filas.slice(pagina * tam, pagina * tam + tam)
}
