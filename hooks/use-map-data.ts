"use client"

import * as React from "react"

import { clienteTiempoReal } from "@/lib/mapa/supabase-navegador"
import {
  bboxDeConsulta,
  CANAL_EN_VIVO,
  EVENTO_EN_VIVO,
  type BBox,
  type MedicionEnVivo,
  type PuntoMapa,
} from "@/lib/mapa/tipos"

const ESPERA_MS = 150
const MAX_CACHE = 50

interface Opciones {
  /** ISO 8601: muestra la última medición anterior o igual a este instante. */
  hasta?: string
}

/**
 * Puntos del mapa para el recuadro visible.
 * - Pide un recuadro ampliado y ajustado a rejilla: los paneos cortos
 *   reutilizan la misma clave y salen de caché sin tocar la red.
 * - Cancela la petición anterior si la cámara se vuelve a mover.
 * - Mantiene los puntos previos mientras carga (sin parpadeos).
 * - Con Supabase Realtime configurado, fusiona las mediciones nuevas en vivo.
 */
export function useMapData(bbox: BBox | null, { hasta }: Opciones = {}) {
  const [puntos, setPuntos] = React.useState<PuntoMapa[]>([])
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [enVivo, setEnVivo] = React.useState(false)
  const [version, setVersion] = React.useState(0)
  const cache = React.useRef(new Map<string, PuntoMapa[]>())
  /** Ciudad → instante de su última actualización en vivo (para animarla). */
  const [recientes, setRecientes] = React.useState<Record<string, number>>({})

  const clave = bbox ? `${bboxDeConsulta(bbox).join(",")}|${hasta ?? ""}` : null

  React.useEffect(() => {
    if (!clave) return
    const controlador = new AbortController()
    const temporizador = setTimeout(async () => {
      const enCache = cache.current.get(clave)
      if (enCache) {
        setPuntos(enCache)
        setCargando(false)
        return
      }
      const [recuadro, instante] = clave.split("|")
      const qs = new URLSearchParams({ bbox: recuadro })
      if (instante) qs.set("hasta", instante)

      setCargando(true)
      try {
        const r = await fetch(`/api/mapa?${qs}`, { signal: controlador.signal })
        const cuerpo = await r.json()
        if (!r.ok) throw new Error(cuerpo.error ?? `HTTP ${r.status}`)
        const nuevos = cuerpo.puntos as PuntoMapa[]
        if (cache.current.size >= MAX_CACHE) {
          cache.current.delete(cache.current.keys().next().value!)
        }
        cache.current.set(clave, nuevos)
        setPuntos(nuevos)
        setError(null)
      } catch (e) {
        if (controlador.signal.aborted) return
        setError(e instanceof Error ? e.message : String(e))
      }
      setCargando(false)
    }, ESPERA_MS)

    return () => {
      clearTimeout(temporizador)
      controlador.abort()
    }
  }, [clave, version])

  // Tiempo real: el trigger de Postgres difunde la última medición por ciudad.
  React.useEffect(() => {
    const supabase = clienteTiempoReal()
    if (!supabase) return
    const limite = hasta ? Date.parse(hasta) : Infinity
    const canal = supabase
      .channel(CANAL_EN_VIVO)
      .on("broadcast", { event: EVENTO_EN_VIVO }, ({ payload }) => {
        const m = payload as MedicionEnVivo
        const instante = Date.parse(m.fecha_hora)
        if (instante > limite) return
        // Lo cacheado ya no es la última medición: se invalida entero.
        cache.current.clear()
        setPuntos((previos) =>
          previos.map((p) =>
            p.ciudad === m.ciudad &&
            (!p.fecha_hora || instante >= Date.parse(p.fecha_hora))
              ? { ...p, ...m }
              : p
          )
        )
        setRecientes((r) => ({ ...r, [m.ciudad]: Date.now() }))
      })
      .subscribe((estado) => setEnVivo(estado === "SUBSCRIBED"))
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [hasta])

  const refrescar = React.useCallback(() => {
    cache.current.clear()
    setVersion((v) => v + 1)
  }, [])

  return { puntos, cargando, error, enVivo, recientes, refrescar }
}
