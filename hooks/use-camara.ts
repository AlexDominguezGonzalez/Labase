"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"
import { useMap } from "react-map-gl/maplibre"

import type { BBox } from "@/lib/mapa/tipos"

export const ID_MAPA = "principal"

/** Hueco que deja libre el panel de detalle para que el punto no quede debajo. */
function margenPaneles() {
  const escritorio = window.matchMedia("(min-width: 768px)").matches
  return escritorio
    ? { top: 96, bottom: 180, left: 440, right: 440 }
    : { top: 96, bottom: Math.round(window.innerHeight * 0.5), left: 32, right: 32 }
}

/** Encuadre general: deja libre el panel de configuración y la barra inferior. */
function margenEncuadre() {
  return window.matchMedia("(min-width: 768px)").matches
    ? { top: 100, bottom: 180, left: 440, right: 100 }
    : 60
}

/**
 * Movimientos de cámara. Solo se llaman como respuesta a una acción explícita
 * del usuario (clic en marcador, sugerencia, botón): los datos en vivo nunca
 * mueven la cámara. Cualquier arrastre del usuario interrumpe el vuelo.
 */
export function useCamara() {
  const mapas = useMap()
  const reducido = useReducedMotion()

  const volarA = React.useCallback(
    (lng: number, lat: number, zoomMinimo = 7) => {
      const mapa = mapas[ID_MAPA]
      if (!mapa) return
      mapa.flyTo({
        center: [lng, lat],
        zoom: Math.max(mapa.getZoom(), zoomMinimo),
        padding: margenPaneles(),
        duration: reducido ? 0 : 1600,
        curve: 1.42,
      })
    },
    [mapas, reducido]
  )

  const encuadrar = React.useCallback(
    ([w, s, e, n]: BBox) => {
      mapas[ID_MAPA]?.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: margenEncuadre(), duration: reducido ? 0 : 1200 }
      )
    },
    [mapas, reducido]
  )

  const zoom = React.useCallback(
    (delta: number) => {
      const mapa = mapas[ID_MAPA]
      mapa?.easeTo({ zoom: mapa.getZoom() + delta, duration: reducido ? 0 : 300 })
    },
    [mapas, reducido]
  )

  return { volarA, encuadrar, zoom }
}
