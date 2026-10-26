"use client"

import { PlayIcon, RotateCcwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES, ciudadPorId } from "@/lib/etl/ciudades"
import { MAX_DIAS, type ValidacionExtraccion } from "@/lib/etl/extraccion"
import type { ExtraccionCiudad } from "@/lib/etl/tipos"

import { EstadoBadge, fmtMs, fmtN } from "./comun"

export function Configuracion({
  ciudadesSel,
  setCiudadesSel,
  inicio,
  fin,
  setInicio,
  setFin,
  validacion,
  enCurso,
  bloqueado,
  alExtraer,
  ciudades,
  alReintentar,
  hayDatosPrevios,
}: {
  ciudadesSel: string[]
  setCiudadesSel: (c: string[]) => void
  inicio: string
  fin: string
  setInicio: (v: string) => void
  setFin: (v: string) => void
  validacion: ValidacionExtraccion
  enCurso: boolean
  bloqueado: boolean
  alExtraer: () => void
  ciudades: ExtraccionCiudad[]
  alReintentar: (id: string) => void
  hayDatosPrevios: boolean
}) {
  const procesadas = ciudades.filter(
    (c) => c.estado === "completada" || c.estado === "error"
  )
  const pendientes = ciudades.filter(
    (c) => c.estado === "pendiente" || c.estado === "en_curso"
  )
  const deshabilitado = validacion.errores.length > 0 || enCurso || bloqueado

  return (
    <section
      aria-labelledby="titulo-config"
      className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[1fr_1fr]"
    >
      <div className="flex flex-col gap-4">
        <h2 id="titulo-config" className="text-lg font-semibold">
          1. Configuración de extracción
        </h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Ciudades</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CIUDADES.map((c) => {
              const id = `ciudad-${c.id}`
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={ciudadesSel.includes(c.id)}
                    disabled={enCurso}
                    onCheckedChange={(v) =>
                      setCiudadesSel(
                        v
                          ? [...ciudadesSel, c.id]
                          : ciudadesSel.filter((x) => x !== c.id)
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {c.nombre}{" "}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ({c.latitud}, {c.longitud})
                    </span>
                  </Label>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="link"
              size="xs"
              className="px-0"
              disabled={enCurso}
              onClick={() => setCiudadesSel(CIUDADES.map((c) => c.id))}
            >
              Todas
            </Button>
            <Button
              variant="link"
              size="xs"
              className="px-0"
              disabled={enCurso}
              onClick={() => setCiudadesSel([])}
            >
              Ninguna
            </Button>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fecha-inicio">Fecha inicial (UTC)</Label>
            <Input
              id="fecha-inicio"
              type="date"
              value={inicio}
              disabled={enCurso}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fecha-fin">Fecha final (UTC)</Label>
            <Input
              id="fecha-fin"
              type="date"
              value={fin}
              disabled={enCurso}
              onChange={(e) => setFin(e.target.value)}
            />
          </div>
        </div>

        <p className="text-sm" aria-live="polite">
          <span className="font-medium">Volumen previsto:</span>{" "}
          {ciudadesSel.length} ciudades × {validacion.dias} días × 24 h ={" "}
          <strong className="tabular-nums">
            {fmtN(validacion.registrosPrevistos)} registros
          </strong>{" "}
          en {ciudadesSel.length} peticiones.{" "}
          <span className="text-muted-foreground">
            Máximo {MAX_DIAS} días por extracción.
          </span>
        </p>

        {validacion.errores.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Revisa la configuración</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {validacion.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={alExtraer} disabled={deshabilitado}>
            <PlayIcon aria-hidden /> {enCurso ? "Extrayendo…" : "Extraer datos"}
          </Button>
          {bloqueado && (
            <span className="text-xs text-muted-foreground">
              Espera a que termine la carga en curso.
            </span>
          )}
          {hayDatosPrevios && !enCurso && !bloqueado && (
            <span className="text-xs text-muted-foreground">
              Una nueva extracción sustituye los datos, la selección y el
              informe de carga actuales.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Progreso de las peticiones</h3>
        {ciudades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se ha lanzado ninguna extracción.
          </p>
        ) : (
          <>
            <p className="text-sm tabular-nums" aria-live="polite">
              Procesadas: {procesadas.length} de {ciudades.length}
              {pendientes.length > 0 &&
                ` · Pendientes: ${pendientes.map((c) => ciudadPorId(c.ciudadId)!.nombre).join(", ")}`}
            </p>
            <ul className="flex flex-col divide-y rounded-lg border">
              {ciudades.map((c) => (
                <li
                  key={c.ciudadId}
                  className="flex flex-col gap-1 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {ciudadPorId(c.ciudadId)!.nombre}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                      {c.json?.hourly?.time && (
                        <span>{fmtN(c.json.hourly.time.length)} horas</span>
                      )}
                      <span>{fmtMs(c.duracionMs)}</span>
                      {c.intentos > 1 && <span>intento {c.intentos}</span>}
                      <EstadoBadge
                        estado={c.estado}
                        texto={c.estado === "error" ? "Error" : undefined}
                      />
                    </div>
                  </div>
                  {c.estado === "error" && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {c.error}
                      </p>
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={enCurso}
                        onClick={() => alReintentar(c.ciudadId)}
                      >
                        <RotateCcwIcon aria-hidden /> Reintentar solo esta
                        ciudad
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
