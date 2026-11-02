// Tipos y utilidades de la vista Map-First (compartidos cliente/servidor).

/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number]

/** Una ciudad en el mapa con su última medición (null si aún no hay datos). */
export interface PuntoMapa {
  ciudad: string
  longitud: number
  latitud: number
  fecha_hora: string | null
  temperatura_c: number | null
  humedad_pct: number | null
  precipitacion_mm: number | null
}

/** Mensaje que difunde el trigger de Supabase por el canal de Broadcast. */
export interface MedicionEnVivo {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export const CANAL_EN_VIVO = "mapa:mediciones"
export const EVENTO_EN_VIVO = "medicion"

/**
 * Amplía el recuadro un 25 % por lado y lo ajusta a una rejilla proporcional
 * a su tamaño. Así, desplazamientos pequeños producen la MISMA clave y se
 * sirven desde caché, sin nueva petición.
 */
export function bboxDeConsulta([w, s, e, n]: BBox): BBox {
  const margenX = (e - w) * 0.25
  const margenY = (n - s) * 0.25
  const paso = Math.max(0.01, 2 ** Math.ceil(Math.log2(Math.max(e - w, n - s) / 4)))
  const abajo = (v: number) => Math.floor(v / paso) * paso
  const arriba = (v: number) => Math.ceil(v / paso) * paso
  return [
    Math.max(-180, abajo(w - margenX)),
    Math.max(-90, abajo(s - margenY)),
    Math.min(180, arriba(e + margenX)),
    Math.min(90, arriba(n + margenY)),
  ]
}

export function contiene([w, s, e, n]: BBox, lng: number, lat: number) {
  return lng >= w && lng <= e && lat >= s && lat <= n
}
