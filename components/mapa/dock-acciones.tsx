"use client"

import { AnimatePresence, motion } from "motion/react"
import { Loader2Icon, MinusIcon, PlayIcon, PlusIcon, ScanIcon, SlidersHorizontalIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface Props {
  onZoom: (delta: number) => void
  onVistaGeneral: () => void
  configAbierta: boolean
  onConfig: () => void
  onExtraer: () => void
  extrayendo: boolean
  extraerDeshabilitado: boolean
}

const boton =
  "grid size-9 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none"

/** Controles del mapa + CTA principal (único botón con color de acento). */
export function DockAcciones({
  onZoom,
  onVistaGeneral,
  configAbierta,
  onConfig,
  onExtraer,
  extrayendo,
  extraerDeshabilitado,
}: Props) {
  return (
    <motion.div
      className="superficie pointer-events-auto flex shrink-0 items-center gap-1 rounded-2xl p-1.5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.3 }}
    >
      <button type="button" className={boton} onClick={() => onZoom(-1)} aria-label="Alejar">
        <MinusIcon className="size-4" />
      </button>
      <button type="button" className={boton} onClick={() => onZoom(1)} aria-label="Acercar">
        <PlusIcon className="size-4" />
      </button>
      <button type="button" className={boton} onClick={onVistaGeneral} aria-label="Vista general">
        <ScanIcon className="size-4" />
      </button>
      <button
        type="button"
        className={cn(boton, configAbierta && "bg-white/10 text-zinc-100")}
        onClick={onConfig}
        aria-label="Configuración de extracción"
        aria-pressed={configAbierta}
      >
        <SlidersHorizontalIcon className="size-4" />
      </button>
      {/* Con la configuración abierta, su propio botón ya es el CTA. */}
      <AnimatePresence initial={false}>
        {!configAbierta && (
          <motion.div
            key="cta"
            className="flex items-center overflow-hidden"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
          >
            <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
            <motion.button
              type="button"
              onClick={onExtraer}
              disabled={extraerDeshabilitado}
              whileHover={extraerDeshabilitado ? undefined : { scale: 1.03 }}
              whileTap={extraerDeshabilitado ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="flex h-9 items-center gap-2 rounded-xl bg-acento px-3.5 text-xs font-medium whitespace-nowrap text-white shadow-[0_0_24px_-6px_var(--acento)] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none disabled:opacity-50 disabled:shadow-none"
            >
              {extrayendo ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
              {extrayendo ? "Extrayendo…" : "Extraer datos"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
