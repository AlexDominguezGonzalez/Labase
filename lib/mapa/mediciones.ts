import { CIUDADES } from "@/lib/etl/ciudades"
import { claveRegistro } from "@/lib/etl/limpieza"
import type { RegistroValido } from "@/lib/etl/tipos"

import type { PuntoMapa } from "./tipos"

/**
 * La clave de MapTiler es pública por diseño (viaja al navegador en cada
 * petición de teselas). Conviene limitarla a tus dominios en el panel de
 * MapTiler. Se puede sustituir con NEXT_PUBLIC_MAPTILER_KEY.
 */
const CLAVE_MAPTILER =
  process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "1Dy07d7Th2f8hjCWEnqq"
export const ESTILO_MAPA =
  process.env.NEXT_PUBLIC_MAPA_ESTILO ??
  `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${CLAVE_MAPTILER}`

export interface IndiceMediciones {
  /** Instantes ISO (UTC) presentes en los datos, ordenados. */
  instantes: string[]
  /** Serie de cada ciudad, ordenada por fecha. */
  porCiudad: Map<string, RegistroValido[]>
  /** Búsqueda directa por la clave natural "ciudad|fecha_hora". */
  porId: Map<string, RegistroValido>
}

export function indexarMediciones(validos: RegistroValido[]): IndiceMediciones {
  const instantes = new Set<string>()
  const porCiudad = new Map<string, RegistroValido[]>()
  const porId = new Map<string, RegistroValido>()
  for (const r of validos) {
    instantes.add(r.fecha_hora)
    porId.set(r.id, r)
    const serie = porCiudad.get(r.ciudad)
    if (serie) serie.push(r)
    else porCiudad.set(r.ciudad, [r])
  }
  for (const serie of porCiudad.values()) {
    serie.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
  }
  return { instantes: [...instantes].sort(), porCiudad, porId }
}

/**
 * Una entrada por ciudad conocida con su medición EXACTA en ese instante.
 * Si la hora se rechazó en la limpieza, la ciudad aparece sin datos: el mapa
 * no inventa ni arrastra valores de otras horas.
 */
export function puntosEn(indice: IndiceMediciones, instante: string | null): PuntoMapa[] {
  return CIUDADES.map((c) => {
    const r = instante ? indice.porId.get(claveRegistro(c.nombre, instante)) : undefined
    return {
      ciudad: c.nombre,
      longitud: c.longitud,
      latitud: c.latitud,
      fecha_hora: r?.fecha_hora ?? null,
      temperatura_c: r?.temperatura_c ?? null,
      humedad_pct: r?.humedad_pct ?? null,
      precipitacion_mm: r?.precipitacion_mm ?? null,
    }
  })
}
