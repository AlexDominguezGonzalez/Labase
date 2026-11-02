"use client"

import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { CrosshairIcon, TableIcon } from "lucide-react"

import { EstadoBadge, fmtD, fmtFechaUtc, fmtMs, fmtN } from "@/components/etl/comun"
import type { ExtraccionCiudad, RegistroValido } from "@/lib/etl/tipos"
import type { PuntoMapa } from "@/lib/mapa/tipos"

import { FloatingPanel } from "./floating-panel"

interface Props {
  punto: PuntoMapa | null
  serie: RegistroValido[]
  instante: string | null
  extraccion?: ExtraccionCiudad
  incluida: boolean
  onCerrar: () => void
  onCentrar: (p: PuntoMapa) => void
  onIrAInstante: (fechaHora: string) => void
  onVerRegistros: (ciudad: string) => void
  onAlternarInclusion: (ciudad: string) => void
}

/** Ficha de una ciudad con SUS datos extraídos: valores, serie y acciones. */
export function DetalleCiudad({
  punto,
  serie,
  instante,
  extraccion,
  incluida,
  onCerrar,
  onCentrar,
  onIrAInstante,
  onVerRegistros,
  onAlternarInclusion,
}: Props) {
  // Conserva el último punto durante la animación de salida.
  const [mostrado, setMostrado] = React.useState(punto)
  if (punto && punto !== mostrado) setMostrado(punto)
  const p = punto ?? mostrado

  const temps = serie.map((r) => r.temperatura_c)
  const resumen = serie.length
    ? {
        min: Math.min(...temps),
        max: Math.max(...temps),
        media: temps.reduce((a, b) => a + b, 0) / temps.length,
        lluvia: serie.reduce((a, r) => a + r.precipitacion_mm, 0),
      }
    : null

  return (
    <FloatingPanel
      abierto={punto !== null}
      titulo={p?.ciudad ?? ""}
      descripcion={instante ? fmtFechaUtc(instante) : "Sin datos extraídos"}
      onCerrar={onCerrar}
      className="w-full md:w-[380px]"
    >
      {p && (
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-end justify-between gap-3">
            <motion.p
              key={`${p.ciudad}-${instante}`}
              initial={{ opacity: 0.4, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-5xl font-light tracking-tight text-zinc-50 tabular-nums"
            >
              {p.temperatura_c ?? "—"}
              <span className="ml-1 align-top text-xl text-zinc-500">°C</span>
            </motion.p>
            {extraccion && (
              <EstadoBadge
                estado={extraccion.estado}
                texto={extraccion.estado === "error" ? "Error" : undefined}
              />
            )}
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5">
            <Dato etiqueta="Humedad" valor={p.humedad_pct} unidad="%" />
            <Dato etiqueta="Precipitación" valor={p.precipitacion_mm} unidad="mm" />
            {resumen && (
              <>
                <Dato etiqueta="Mín · máx" valor={`${resumen.min} · ${resumen.max}`} unidad="°C" />
                <Dato etiqueta="Media" valor={fmtD(resumen.media)} unidad="°C" />
                <Dato etiqueta="Lluvia total" valor={fmtD(resumen.lluvia)} unidad="mm" />
                <Dato etiqueta="Horas válidas" valor={fmtN(serie.length)} unidad="" />
              </>
            )}
          </dl>

          {serie.length > 1 && (
            <Serie serie={serie} instante={instante} onIrAInstante={onIrAInstante} />
          )}

          {extraccion?.estado === "error" && (
            <p className="text-xs text-destructive">{extraccion.error}</p>
          )}
          {extraccion && (
            <p className="text-[11px] text-zinc-500">
              Petición: {fmtMs(extraccion.duracionMs)}
              {extraccion.intentos > 1 && ` · intento ${extraccion.intentos}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <BotonSecundario onClick={() => onCentrar(p)}>
              <CrosshairIcon className="size-3.5" /> Centrar
            </BotonSecundario>
            <BotonSecundario onClick={() => onVerRegistros(p.ciudad)} disabled={!serie.length}>
              <TableIcon className="size-3.5" /> Ver registros
            </BotonSecundario>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-zinc-400">
            Incluir en la próxima extracción
            <input
              type="checkbox"
              checked={incluida}
              onChange={() => onAlternarInclusion(p.ciudad)}
              className="size-4 accent-[var(--acento)]"
            />
          </label>
        </div>
      )}
    </FloatingPanel>
  )
}

function BotonSecundario(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 text-xs text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
    />
  )
}

function Dato({ etiqueta, valor, unidad }: { etiqueta: string; valor: React.ReactNode; unidad: string }) {
  return (
    <div className="bg-zinc-950/50 px-4 py-3">
      <dt className="text-[11px] text-zinc-500">{etiqueta}</dt>
      <dd className="mt-0.5 font-mono text-base text-zinc-100 tabular-nums">
        {valor ?? "—"}
        {unidad && <span className="ml-1 text-xs text-zinc-500">{unidad}</span>}
      </dd>
    </div>
  )
}

const ANCHO = 320
const ALTO = 72

/** Serie completa de temperatura. Clic en la gráfica = mover el mapa a esa hora. */
function Serie({
  serie,
  instante,
  onIrAInstante,
}: {
  serie: RegistroValido[]
  instante: string | null
  onIrAInstante: (fechaHora: string) => void
}) {
  const reducido = useReducedMotion()
  const temps = serie.map((r) => r.temperatura_c)
  const min = Math.min(...temps)
  const rango = Math.max(...temps) - min || 1
  const x = (i: number) => (i / (serie.length - 1)) * ANCHO
  const y = (t: number) => ALTO - 4 - ((t - min) / rango) * (ALTO - 8)
  const linea = serie
    .map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.temperatura_c).toFixed(1)}`)
    .join("")
  const actual = serie.findIndex((r) => r.fecha_hora === instante)

  function alPulsar(e: React.MouseEvent<SVGSVGElement>) {
    const caja = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - caja.left) / caja.width) * (serie.length - 1))
    onIrAInstante(serie[Math.max(0, Math.min(serie.length - 1, i))].fecha_hora)
  }

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex justify-between text-[11px] text-zinc-500">
        <span>Temperatura · {fmtN(serie.length)} h</span>
        <span>Pulsa para ver esa hora</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="h-[72px] w-full cursor-crosshair overflow-visible"
        onClick={alPulsar}
        aria-hidden
      >
        <defs>
          <linearGradient id="relleno-serie" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--acento)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--acento)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${linea}L${ANCHO},${ALTO}L0,${ALTO}Z`} fill="url(#relleno-serie)" />
        <motion.path
          key={serie[0].ciudad}
          d={linea}
          fill="none"
          stroke="var(--acento)"
          strokeWidth={1.25}
          strokeLinejoin="round"
          initial={reducido ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {actual >= 0 && (
          <>
            <line x1={x(actual)} x2={x(actual)} y1={0} y2={ALTO} stroke="white" strokeOpacity={0.2} />
            <circle cx={x(actual)} cy={y(serie[actual].temperatura_c)} r={3.5} fill="var(--acento)" stroke="black" strokeOpacity={0.5} />
          </>
        )}
      </svg>
    </figure>
  )
}
