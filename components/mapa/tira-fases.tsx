"use client"

import { motion } from "motion/react"
import { ChevronRightIcon } from "lucide-react"

import { fmtMs, type Estado } from "@/components/etl/comun"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { Pestana } from "@/hooks/use-pipeline-etl"
import { cn } from "@/lib/utils"

const PUNTO: Record<Estado, string> = {
  pendiente: "bg-zinc-600",
  en_curso: "bg-acento animate-pulse motion-reduce:animate-none",
  completada: "bg-zinc-100",
  completado: "bg-zinc-100",
  error: "bg-destructive",
}
const TEXTO: Record<Estado, string> = {
  pendiente: "pendiente",
  en_curso: "en curso",
  completada: "completada",
  completado: "completada",
  error: "con errores",
}

interface Props {
  fases: PipelineEtl["fases"]
  activa: Pestana | null
  onInspeccionar: (pestana: Pestana) => void
}

/** Las cinco fases del ETL como una tira flotante; cada una abre su inspección. */
export function TiraFases({ fases, activa, onInspeccionar }: Props) {
  return (
    <motion.ol
      aria-label="Fases del pipeline"
      className="superficie pointer-events-auto flex max-w-full items-stretch gap-0.5 overflow-x-auto rounded-2xl p-1.5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.25 }}
    >
      {fases.map((f, i) => (
        <li key={f.nombre} className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onInspeccionar(f.pestana)}
            title={f.explicacion}
            aria-pressed={activa === f.pestana}
            className={cn(
              "flex flex-col gap-0.5 rounded-xl px-3 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none",
              activa === f.pestana ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-100">
              <span aria-hidden className={cn("size-1.5 rounded-full", PUNTO[f.estado])} />
              <span className="text-zinc-500">{i + 1}</span>
              {f.nombre}
              <span className="sr-only">: {TEXTO[f.estado]}</span>
            </span>
            <span className="font-mono text-[11px] whitespace-nowrap text-zinc-400 tabular-nums">
              {f.salida} · {fmtMs(f.duracion)}
            </span>
          </button>
          {i < fases.length - 1 && (
            <ChevronRightIcon aria-hidden className="size-3 shrink-0 text-zinc-700" />
          )}
        </li>
      ))}
    </motion.ol>
  )
}
