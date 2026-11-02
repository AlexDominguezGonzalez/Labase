"use client"

import * as React from "react"
import { motion } from "motion/react"
import { PauseIcon, PlayIcon } from "lucide-react"

import { fmtFechaUtc } from "@/components/etl/comun"

interface Props {
  instantes: string[]
  indice: number
  onCambiar: (indice: number) => void
}

const PASO_MS = 180

/**
 * Recorre las horas extraídas: los marcadores muestran la medición de cada
 * ciudad en ese instante. La reproducción solo arranca si el usuario la pide.
 */
export function LineaTiempo({ instantes, indice, onCambiar }: Props) {
  const [reproduciendo, setReproduciendo] = React.useState(false)
  const ultimo = instantes.length - 1

  React.useEffect(() => {
    if (!reproduciendo) return
    const t = setInterval(() => {
      if (indice >= ultimo) setReproduciendo(false)
      else onCambiar(indice + 1)
    }, PASO_MS)
    return () => clearInterval(t)
  }, [reproduciendo, indice, ultimo, onCambiar])

  return (
    <motion.div
      className="superficie pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl py-1.5 pr-4 pl-1.5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <button
        type="button"
        onClick={() => {
          if (!reproduciendo && indice >= ultimo) onCambiar(0)
          setReproduciendo((r) => !r)
        }}
        aria-label={reproduciendo ? "Pausar" : "Reproducir las horas"}
        className="grid size-8 shrink-0 place-items-center rounded-xl text-zinc-300 hover:bg-white/5 hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none"
      >
        {reproduciendo ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={ultimo}
        value={indice}
        onChange={(e) => {
          setReproduciendo(false)
          onCambiar(Number(e.target.value))
        }}
        aria-label="Hora mostrada en el mapa"
        aria-valuetext={fmtFechaUtc(instantes[indice])}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--acento)]"
      />
      <span className="shrink-0 font-mono text-[11px] text-zinc-300 tabular-nums">
        {fmtFechaUtc(instantes[indice])}
      </span>
    </motion.div>
  )
}
