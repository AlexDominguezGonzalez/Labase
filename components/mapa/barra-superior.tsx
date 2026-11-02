"use client"

import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { CIUDADES } from "@/lib/etl/ciudades"
import { useEstadoMapa } from "@/lib/mapa/estado"

interface Props {
  onExplorar: (ciudad: string, lng: number, lat: number) => void
}

/**
 * Marca + sugerencias de zonas. Pasar el ratón por una sugerencia resalta su
 * marcador en el mapa (sin mover la cámara); solo el clic vuela hasta ella.
 */
export function BarraSuperior({ onExplorar }: Props) {
  const seleccionada = useEstadoMapa((s) => s.seleccionada)
  const sobrevolar = useEstadoMapa((s) => s.sobrevolar)

  return (
    <motion.div
      className="superficie pointer-events-auto flex max-w-full items-center self-start gap-3 overflow-x-auto rounded-2xl p-1.5 pr-2"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
    >
      <div className="flex shrink-0 items-center gap-2.5 pl-2.5">
        <span className="size-2 rounded-full bg-acento shadow-[0_0_10px_var(--acento)]" />
        <span className="text-sm font-medium tracking-tight text-zinc-100">
          BaseBig
        </span>
        <span className="hidden text-xs text-zinc-500 sm:inline">
          Clima · Open-Meteo
        </span>
      </div>
      <span className="h-5 w-px shrink-0 bg-white/10" />
      <nav aria-label="Explorar ciudades" className="flex gap-1">
        {CIUDADES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onExplorar(c.nombre, c.longitud, c.latitud)}
            onMouseEnter={() => sobrevolar(c.nombre)}
            onMouseLeave={() => sobrevolar(null)}
            onFocus={() => sobrevolar(c.nombre)}
            onBlur={() => sobrevolar(null)}
            aria-pressed={seleccionada === c.nombre}
            className={cn(
              "h-7 shrink-0 rounded-lg px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none",
              seleccionada === c.nombre
                ? "bg-white/10 text-zinc-50"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            )}
          >
            {c.nombre}
          </button>
        ))}
      </nav>
    </motion.div>
  )
}
