"use client"

import * as React from "react"
import { DownloadIcon, RotateCcwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ciudadPorId } from "@/lib/etl/ciudades"
import { MOTIVO_DUPLICADO } from "@/lib/etl/limpieza"
import type {
  ExtraccionCiudad,
  RegistroRechazado,
  RegistroTransformado,
} from "@/lib/etl/tipos"

import {
  descargarJson,
  EstadoBadge,
  fmtFechaUtc,
  fmtN,
  TablaPaginada,
  ValorCrudo,
  type Columna,
} from "./comun"

const LIMITE_JSON_VISIBLE = 40_000

export function PestanaJson({
  ciudades,
  alReintentar,
}: {
  ciudades: ExtraccionCiudad[]
  alReintentar: (id: string) => void
}) {
  const [activa, setActiva] = React.useState<string>()
  if (ciudades.length === 0)
    return <Vacio texto="Lanza una extracción para ver los JSON originales." />
  const actual = ciudades.find((c) => c.ciudadId === activa) ?? ciudades[0]
  const nombre = ciudadPorId(actual.ciudadId)!.nombre
  const texto = actual.json ? JSON.stringify(actual.json, null, 2) : ""
  const conJson = ciudades.filter((c) => c.json)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Ciudad" className="flex flex-wrap gap-1">
          {ciudades.map((c) => (
            <Button
              key={c.ciudadId}
              size="sm"
              variant={c.ciudadId === actual.ciudadId ? "default" : "outline"}
              aria-pressed={c.ciudadId === actual.ciudadId}
              onClick={() => setActiva(c.ciudadId)}
            >
              {ciudadPorId(c.ciudadId)!.nombre}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={conJson.length === 0}
          onClick={() =>
            descargarJson(
              "open-meteo-originales.json",
              Object.fromEntries(
                conJson.map((c) => [ciudadPorId(c.ciudadId)!.nombre, c.json])
              )
            )
          }
        >
          <DownloadIcon aria-hidden /> Descargar todos ({conJson.length})
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{nombre}</span>
            <EstadoBadge estado={actual.estado} />
          </div>
          <div className="flex gap-2">
            {actual.estado === "error" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => alReintentar(actual.ciudadId)}
              >
                <RotateCcwIcon aria-hidden /> Reintentar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!actual.json}
              onClick={() =>
                descargarJson(`open-meteo-${actual.ciudadId}.json`, actual.json)
              }
            >
              <DownloadIcon aria-hidden /> Descargar JSON
            </Button>
          </div>
        </div>
        <p className="font-mono text-xs break-all text-muted-foreground">
          GET {actual.url}
        </p>
        {actual.error && (
          <p className="text-sm text-red-700 dark:text-red-300">
            {actual.error}
          </p>
        )}
        {actual.json && (
          <>
            <p className="text-xs text-muted-foreground">
              Respuesta conservada tal cual durante la sesión (
              {fmtN(texto.length)} caracteres). Fíjate en que «hourly» contiene
              arrays paralelos: la posición <em>i</em> de cada array corresponde
              a la misma hora.
            </p>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {texto.length > LIMITE_JSON_VISIBLE
                ? `${texto.slice(0, LIMITE_JSON_VISIBLE)}\n… (truncado en pantalla; descarga el JSON para verlo completo)`
                : texto}
            </pre>
          </>
        )}
      </div>
    </div>
  )
}

const COLUMNAS_TRANSFORMADOS: Columna<RegistroTransformado>[] = [
  { titulo: "Ciudad", celda: (r) => r.ciudad },
  { titulo: "Índice", alinear: "derecha", celda: (r) => r.indice },
  {
    titulo: "time original",
    celda: (r) => <ValorCrudo valor={r.fecha_hora_original} />,
  },
  {
    titulo: "fecha_hora",
    unidad: "UTC",
    celda: (r) =>
      r.fecha_hora ? fmtFechaUtc(r.fecha_hora) : <ValorCrudo valor={null} />,
  },
  {
    titulo: "temperatura_c",
    unidad: "°C",
    alinear: "derecha",
    celda: (r) => <ValorCrudo valor={r.temperatura_original} />,
  },
  {
    titulo: "humedad_pct",
    unidad: "%",
    alinear: "derecha",
    celda: (r) => <ValorCrudo valor={r.humedad_original} />,
  },
  {
    titulo: "precipitacion_mm",
    unidad: "mm",
    alinear: "derecha",
    celda: (r) => <ValorCrudo valor={r.precipitacion_original} />,
  },
]

export function PestanaTransformados({
  registros,
  avisos,
}: {
  registros: RegistroTransformado[]
  avisos: { ciudad: string; avisos: string[] }[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Cada posición de los arrays se convierte en una fila. Los valores se
        muestran sin modificar: un <em>null</em> sigue siendo <em>null</em>{" "}
        (nunca se convierte en 0). La fecha se interpreta explícitamente como
        UTC.
      </p>
      {avisos.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Problemas estructurales en las respuestas</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {avisos.flatMap((a) =>
                a.avisos.map((t) => (
                  <li key={a.ciudad + t}>
                    {a.ciudad}: {t}
                  </li>
                ))
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <TablaPaginada
        etiqueta="Registros transformados"
        filas={registros}
        columnas={COLUMNAS_TRANSFORMADOS}
        clave={(r) => r.id}
        vacio="Sin registros transformados todavía."
      />
    </div>
  )
}

const COLUMNAS_RECHAZADOS: Columna<RegistroRechazado>[] = [
  ...(COLUMNAS_TRANSFORMADOS.map((c) => ({
    ...c,
    celda: (r: RegistroRechazado) => c.celda(r.registro),
  })) as Columna<RegistroRechazado>[]),
  {
    titulo: "Motivo del rechazo",
    celda: (r) => (
      <ul className="text-xs text-red-700 dark:text-red-300">
        {r.motivos.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    ),
  },
]

export function PestanaRechazados({
  rechazados,
  duplicados,
}: {
  rechazados: RegistroRechazado[]
  duplicados: number
}) {
  const porCalidad = rechazados.length - duplicados
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Descartes <strong>por calidad</strong>: {fmtN(porCalidad)} (sin ciudad,
        fecha no válida, medición nula/ausente/no numérica, humedad fuera de
        0–100 %, precipitación negativa). Duplicados eliminados:{" "}
        {fmtN(duplicados)} ({MOTIVO_DUPLICADO.toLowerCase()}). No se aplican
        umbrales a la temperatura. Los registros que excluyas con filtros{" "}
        <strong>no</strong> aparecen aquí: siguen siendo válidos.
      </p>
      <TablaPaginada
        etiqueta="Registros rechazados"
        filas={rechazados}
        columnas={COLUMNAS_RECHAZADOS}
        clave={(r) => r.registro.id}
        vacio="Ningún registro rechazado: todos superaron la limpieza."
      />
    </div>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {texto}
    </p>
  )
}
