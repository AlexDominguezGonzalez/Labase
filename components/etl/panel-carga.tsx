"use client"

import { InfoIcon, RotateCcwIcon, UploadIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { resumenLotes, TAM_LOTE, type Lote } from "@/lib/etl/carga"
import type { Orden } from "@/lib/etl/filtrado"
import type { FilaCarga } from "@/lib/etl/tipos"

import {
  EstadoBadge,
  fmtD,
  fmtFechaUtc,
  fmtMs,
  fmtN,
  TablaPaginada,
  type Columna,
} from "./comun"

export interface Verificacion {
  estado: "completada" | "error"
  comprobadas: number
  encontradas: number
  faltan: { ciudad: string; fecha_hora: string }[]
  error?: string
}

export interface EstadoCarga {
  lotes: Lote[]
  total: number
  huella: string
  estado: "enviando" | "verificando" | "terminada"
  verificacion?: Verificacion
  duracionMs?: number
}

type FilaNumerada = FilaCarga & { n: number }

const COLUMNAS: Columna<FilaNumerada>[] = [
  { titulo: "#", alinear: "derecha", celda: (r) => fmtN(r.n) },
  { titulo: "ciudad", celda: (r) => r.ciudad },
  {
    titulo: "fecha_hora",
    unidad: "UTC",
    celda: (r) => fmtFechaUtc(r.fecha_hora),
  },
  {
    titulo: "temperatura_c",
    unidad: "°C",
    alinear: "derecha",
    celda: (r) => fmtD(r.temperatura_c),
  },
  {
    titulo: "humedad_pct",
    unidad: "%",
    alinear: "derecha",
    celda: (r) => fmtN(r.humedad_pct),
  },
  {
    titulo: "precipitacion_mm",
    unidad: "mm",
    alinear: "derecha",
    celda: (r) => fmtD(r.precipitacion_mm),
  },
]

const NOMBRES_CAMPO: Record<Orden["campo"], string> = {
  ciudad: "ciudad",
  fecha_hora: "fecha y hora",
  temperatura_c: "temperatura",
  humedad_pct: "humedad",
  precipitacion_mm: "precipitación",
}

export function PanelCarga({
  filas,
  huellaVistaPrevia,
  orden,
  fueraDeFiltros,
  carga,
  alSubir,
  alReintentar,
}: {
  filas: FilaCarga[]
  huellaVistaPrevia: string
  orden: Orden
  fueraDeFiltros: number
  carga: EstadoCarga | null
  alSubir: () => void
  alReintentar: () => void
}) {
  const enCurso = carga !== null && carga.estado !== "terminada"
  const numeradas = filas.map((f, i) => ({ ...f, n: i + 1 }))
  const resumen = carga ? resumenLotes(carga.lotes) : null
  const fallidos = carga?.lotes.filter((l) => l.estado === "error").length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1 text-sm">
          <p>
            Este es <strong>exactamente</strong> el conjunto que se enviará:{" "}
            <strong className="tabular-nums">
              {fmtN(filas.length)} registros
            </strong>
            , en {Math.ceil(filas.length / TAM_LOTE)}{" "}
            {Math.ceil(filas.length / TAM_LOTE) === 1 ? "lote" : "lotes"} de
            hasta {TAM_LOTE}, ordenados por {NOMBRES_CAMPO[orden.campo]} (
            {orden.direccion === "asc" ? "ascendente" : "descendente"}).
          </p>
          <p className="text-xs text-muted-foreground">
            Huella del conjunto:{" "}
            <code className="font-mono">{huellaVistaPrevia}</code>
            {fueraDeFiltros > 0 &&
              ` · ${fmtN(fueraDeFiltros)} filas seleccionadas quedan fuera de los filtros y no se incluyen.`}
          </p>
        </div>
        <Button
          size="lg"
          onClick={alSubir}
          disabled={enCurso || filas.length === 0}
        >
          <UploadIcon aria-hidden />
          {enCurso
            ? "Carga en curso…"
            : `Subir ${fmtN(filas.length)} registros a Supabase`}
        </Button>
      </div>

      <Alert>
        <InfoIcon aria-hidden />
        <AlertTitle>El orden no se guarda en la tabla</AlertTitle>
        <AlertDescription>
          Enviamos las filas en el orden elegido, pero una base de datos
          relacional no garantiza conservar el orden de inserción. Para leerlas
          ordenadas, cualquier consulta posterior necesita <code>ORDER BY</code>{" "}
          (por ejemplo, <code>ORDER BY fecha_hora, ciudad</code>).
        </AlertDescription>
      </Alert>

      {carga && resumen && (
        <section
          aria-labelledby="titulo-informe"
          className="flex flex-col gap-3 rounded-lg border p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="titulo-informe" className="font-medium">
              Informe de carga
            </h3>
            <EstadoBadge
              estado={
                enCurso
                  ? "en_curso"
                  : fallidos > 0 || carga.verificacion?.estado === "error"
                    ? "error"
                    : "completada"
              }
              texto={
                carga.estado === "enviando"
                  ? "Enviando lotes"
                  : carga.estado === "verificando"
                    ? "Verificando en destino"
                    : undefined
              }
            />
          </div>
          <p className="text-sm tabular-nums" aria-live="polite">
            Conjunto congelado al iniciar: {fmtN(carga.total)} registros (huella{" "}
            <code className="font-mono">{carga.huella}</code>
            {carga.huella === huellaVistaPrevia
              ? ", coincide con la vista previa actual"
              : ", la vista previa ha cambiado desde entonces; la carga no se ve afectada"}
            ). Procesados correctamente:{" "}
            <strong>{fmtN(resumen.correctas)}</strong> · Fallidos:{" "}
            <strong>{fmtN(resumen.fallidas)}</strong>
            {resumen.pendientes > 0 &&
              ` · Pendientes: ${fmtN(resumen.pendientes)}`}
            {carga.duracionMs !== undefined &&
              ` · Duración: ${fmtMs(carga.duracionMs)}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Supabase devuelve las filas escritas por el upsert sin indicar
            cuáles eran nuevas y cuáles se actualizaron, así que no mostramos
            esa distinción.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Lote</th>
                  <th className="py-1 pr-3 font-medium">Filas</th>
                  <th className="py-1 pr-3 font-medium">Estado</th>
                  <th className="py-1 pr-3 font-medium">Procesadas</th>
                  <th className="py-1 pr-3 font-medium">Intentos</th>
                  <th className="py-1 pr-3 font-medium">Duración</th>
                  <th className="py-1 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {carga.lotes.map((l) => (
                  <tr key={l.numero}>
                    <td className="py-1 pr-3">{l.numero}</td>
                    <td className="py-1 pr-3">{fmtN(l.filas.length)}</td>
                    <td className="py-1 pr-3">
                      <EstadoBadge
                        estado={l.estado}
                        texto={l.estado === "error" ? "Error" : undefined}
                      />
                    </td>
                    <td className="py-1 pr-3">
                      {l.procesadas !== undefined ? fmtN(l.procesadas) : "—"}
                    </td>
                    <td className="py-1 pr-3">{l.intentos}</td>
                    <td className="py-1 pr-3">{fmtMs(l.duracionMs)}</td>
                    <td className="py-1 text-xs text-red-700 dark:text-red-300">
                      {l.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fallidos > 0 && !enCurso && (
            <div>
              <Button variant="outline" onClick={alReintentar}>
                <RotateCcwIcon aria-hidden /> Reintentar {fallidos} lote(s)
                fallido(s)
              </Button>
            </div>
          )}

          {carga.verificacion && (
            <Alert
              variant={
                carga.verificacion.estado === "error"
                  ? "destructive"
                  : "default"
              }
            >
              <AlertTitle>Verificación en destino</AlertTitle>
              <AlertDescription>
                {carga.verificacion.error && (
                  <p>No se pudo completar: {carga.verificacion.error}</p>
                )}
                <p className="tabular-nums">
                  Claves consultadas en Supabase:{" "}
                  {fmtN(carga.verificacion.comprobadas)} · encontradas:{" "}
                  {fmtN(carga.verificacion.encontradas)} · no encontradas:{" "}
                  {fmtN(carga.verificacion.faltan.length)}
                  {fallidos > 0 && " (solo se verifican los lotes completados)"}
                </p>
                {carga.verificacion.faltan.slice(0, 10).map((k) => (
                  <p
                    key={k.ciudad + k.fecha_hora}
                    className="font-mono text-xs"
                  >
                    Falta: {k.ciudad} · {fmtFechaUtc(k.fecha_hora)}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </section>
      )}

      <TablaPaginada
        etiqueta="Vista previa de la carga"
        filas={numeradas}
        columnas={COLUMNAS}
        clave={(r) => `${r.ciudad}|${r.fecha_hora}`}
        vacio="No hay filas seleccionadas que cumplan los filtros. Selecciónalas en «Válidos y selección»."
      />
    </div>
  )
}
