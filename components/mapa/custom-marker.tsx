"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Marker } from "react-map-gl/maplibre"

import { cn } from "@/lib/utils"
import type { PuntoMapa } from "@/lib/mapa/tipos"

const MUELLE = { type: "spring", stiffness: 420, damping: 18 } as const

/** Desfase estable por ciudad: los marcadores no "respiran" a la vez. */
function desfase(texto: string) {
  let h = 0
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 1000) / 1000
}

/** Estado de la ciudad en el pipeline (extracción en curso, fallida…). */
export type EstadoMarcador = "reposo" | "cargando" | "error"

interface Props {
  punto: PuntoMapa
  estado: EstadoMarcador
  /** Seleccionado: color de acento y pulso continuo. */
  activo: boolean
  /** Sobrevolado aquí o desde otra parte de la UI (sugerencias, tablas…). */
  resaltado: boolean
  /** Ciudad fuera de la configuración de extracción actual. */
  atenuado: boolean
  onSeleccionar: (ciudad: string) => void
  onResaltar: (ciudad: string | null) => void
}

export const CustomMarker = React.memo(function CustomMarker({
  punto,
  estado,
  activo,
  resaltado,
  atenuado,
  onSeleccionar,
  onResaltar,
}: Props) {
  const reducido = useReducedMotion()
  const hayDato = punto.temperatura_c !== null
  const temperatura = hayDato
    ? `${punto.temperatura_c!.toLocaleString("es-ES", { maximumFractionDigits: 1 })}°`
    : null

  return (
    <Marker
      longitude={punto.longitud}
      latitude={punto.latitud}
      anchor="center"
      style={{ zIndex: activo ? 3 : resaltado ? 2 : 1 }}
      onClick={(e) => {
        // Listener nativo del marcador: evita que el mapa reciba el clic.
        e.originalEvent.stopPropagation()
        onSeleccionar(punto.ciudad)
      }}
    >
      <motion.button
        type="button"
        aria-label={`${punto.ciudad}${temperatura ? `, ${temperatura}C` : ", sin datos"}`}
        aria-pressed={activo}
        className="relative grid size-10 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-acento"
        onHoverStart={() => onResaltar(punto.ciudad)}
        onHoverEnd={() => onResaltar(null)}
        onFocus={() => onResaltar(punto.ciudad)}
        onBlur={() => onResaltar(null)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: resaltado && !activo ? 1.25 : 1,
          opacity: atenuado && !activo ? 0.45 : 1,
        }}
        whileTap={{ scale: 0.9 }}
        transition={MUELLE}
      >
        {/* Reposo: respiración muy sutil, monocroma. */}
        {!reducido && estado === "reposo" && !activo && (
          <motion.span
            aria-hidden
            className="absolute inset-2.5 rounded-full bg-white/30"
            animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0, 0.5] }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: desfase(punto.ciudad) * 3.2,
            }}
          />
        )}

        {/* Activo o descargando: pulso de acento continuo. */}
        {!reducido && (activo || estado === "cargando") && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-acento/45"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{
              duration: estado === "cargando" ? 1 : 1.8,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        )}

        <motion.span
          aria-hidden
          className={cn(
            "relative size-3 rounded-full ring-2 ring-black/50 transition-colors duration-300",
            activo || estado === "cargando"
              ? "bg-acento shadow-[0_0_18px_var(--acento)]"
              : estado === "error"
                ? "bg-destructive"
                : hayDato
                  ? "bg-white"
                  : "bg-zinc-400"
          )}
          animate={{ scale: activo ? 1.35 : 1 }}
          transition={MUELLE}
        />

        {/* Temperatura siempre visible; sombra para leerse sobre el satélite. */}
        <AnimatePresence>
          {temperatura && (
            <motion.span
              key="etiqueta"
              aria-hidden
              className="pointer-events-none absolute top-full -mt-1.5 font-mono text-[11px] font-medium text-white tabular-nums [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {temperatura}
            </motion.span>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {resaltado && !activo && (
            <motion.span
              role="tooltip"
              className="superficie pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-left whitespace-nowrap"
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <span className="block text-xs font-medium text-zinc-100">
                {punto.ciudad}
              </span>
              <span className="block font-mono text-[11px] text-zinc-400 tabular-nums">
                {estado === "cargando"
                  ? "Extrayendo…"
                  : estado === "error"
                    ? "Error en la extracción"
                    : hayDato
                      ? `${punto.temperatura_c} °C · ${punto.humedad_pct} % · ${punto.precipitacion_mm} mm`
                      : "Sin datos a esta hora"}
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </Marker>
  )
})
