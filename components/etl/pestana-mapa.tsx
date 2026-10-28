"use client"

import * as React from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import { CIUDADES } from "@/lib/etl/ciudades"
import type { FilaCarga } from "@/lib/etl/tipos"

/**
 * La clave de MapTiler es pública por diseño (viaja al navegador en cada
 * petición de teselas). Conviene limitarla a tus dominios en el panel de
 * MapTiler. Se puede sustituir con NEXT_PUBLIC_MAPTILER_KEY.
 */
const CLAVE_MAPTILER =
  process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "1Dy07d7Th2f8hjCWEnqq"
const ESTILO = `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${CLAVE_MAPTILER}`

/** Vista inicial: el recuadro que contiene todas las ciudades. */
const LIMITES: [[number, number], [number, number]] = [
  [
    Math.min(...CIUDADES.map((c) => c.longitud)),
    Math.min(...CIUDADES.map((c) => c.latitud)),
  ],
  [
    Math.max(...CIUDADES.map((c) => c.longitud)),
    Math.max(...CIUDADES.map((c) => c.latitud)),
  ],
]

/** Última medición de cada ciudad entre los registros válidos. */
function ultimaPorCiudad(filas: FilaCarga[]) {
  const ultima = new Map<string, FilaCarga>()
  for (const f of filas) {
    const actual = ultima.get(f.ciudad)
    if (!actual || f.fecha_hora > actual.fecha_hora) ultima.set(f.ciudad, f)
  }
  return ultima
}

function contenidoPopup(nombre: string, fila?: FilaCarga) {
  const div = document.createElement("div")
  div.className = "text-xs text-neutral-900"
  const titulo = document.createElement("strong")
  titulo.textContent = nombre
  div.append(titulo)
  const linea = (texto: string) => {
    const p = document.createElement("div")
    p.textContent = texto
    div.append(p)
  }
  if (fila) {
    linea(
      new Date(fila.fecha_hora).toLocaleString("es-ES", { timeZone: "UTC" }) +
        " UTC"
    )
    linea(`Temperatura: ${fila.temperatura_c} °C`)
    linea(`Humedad: ${fila.humedad_pct} %`)
    linea(`Precipitación: ${fila.precipitacion_mm} mm`)
  } else {
    linea("Sin datos extraídos todavía.")
  }
  return div
}

export function PestanaMapa({ filas }: { filas: FilaCarga[] }) {
  const refContenedor = React.useRef<HTMLDivElement>(null)
  const refMapa = React.useRef<maplibregl.Map | null>(null)
  const [error, setError] = React.useState<string>()

  React.useEffect(() => {
    if (!refContenedor.current) return
    const mapa = new maplibregl.Map({
      container: refContenedor.current,
      style: ESTILO,
      bounds: LIMITES,
      fitBoundsOptions: { padding: 60 },
    })
    mapa.addControl(new maplibregl.NavigationControl(), "top-right")
    mapa.on("error", (e) => {
      // Un fallo del estilo (clave no válida, sin red) deja el mapa en blanco.
      if (!mapa.isStyleLoaded())
        setError(e.error?.message ?? "Error al cargar el mapa.")
    })
    refMapa.current = mapa
    return () => {
      mapa.remove()
      refMapa.current = null
    }
  }, [])

  React.useEffect(() => {
    const mapa = refMapa.current
    if (!mapa) return
    const ultima = ultimaPorCiudad(filas)
    const marcadores = CIUDADES.map((c) =>
      new maplibregl.Marker({ color: "#e11d48" })
        .setLngLat([c.longitud, c.latitud])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setDOMContent(
            contenidoPopup(c.nombre, ultima.get(c.nombre))
          )
        )
        .addTo(mapa)
    )
    return () => marcadores.forEach((m) => m.remove())
  }, [filas])

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Pulsa un marcador para ver la última medición de esa ciudad entre los
        registros válidos extraídos.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div
        ref={refContenedor}
        className="h-[28rem] w-full overflow-hidden rounded-lg border"
      />
    </div>
  )
}
