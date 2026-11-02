"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useEsEscritorio } from "@/hooks/use-es-escritorio"

interface Props {
  abierto: boolean
  titulo: string
  descripcion?: React.ReactNode
  /** Lado desde el que entra en escritorio. En móvil siempre sube desde abajo. */
  lado?: "izquierda" | "derecha"
  onCerrar: () => void
  className?: string
  children: React.ReactNode
}

/**
 * Panel flotante NO modal: el mapa sigue siendo interactivo detrás.
 * Entra y sale con un muelle suave; Escape lo cierra.
 */
export function FloatingPanel({
  abierto,
  titulo,
  descripcion,
  lado = "derecha",
  onCerrar,
  className,
  children,
}: Props) {
  const reducido = useReducedMotion()
  const escritorio = useEsEscritorio()
  const idTitulo = React.useId()

  React.useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar()
    window.addEventListener("keydown", alPulsar)
    return () => window.removeEventListener("keydown", alPulsar)
  }, [abierto, onCerrar])

  const fuera = reducido
    ? { opacity: 0 }
    : escritorio
      ? { opacity: 0, x: lado === "derecha" ? 32 : -32, scale: 0.98 }
      : { opacity: 0, y: 48 }

  return (
    <AnimatePresence>
      {abierto && (
        <motion.section
          key="panel"
          aria-labelledby={idTitulo}
          className={cn(
            "superficie pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-2xl",
            className
          )}
          initial={fuera}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={fuera}
          transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-white/5 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 id={idTitulo} className="truncate text-sm font-medium text-zinc-100">
                {titulo}
              </h2>
              {descripcion && (
                <div className="mt-0.5 text-xs text-zinc-500">{descripcion}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar panel"
              className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none"
            >
              <XIcon className="size-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
