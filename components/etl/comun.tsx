"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  Loader2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type Estado =
  "pendiente" | "en_curso" | "completada" | "completado" | "error"

const ESTADOS: Record<
  Estado,
  { texto: string; icono: React.ElementType; clase: string }
> = {
  pendiente: {
    texto: "Pendiente",
    icono: CircleDashedIcon,
    clase: "border-border text-muted-foreground",
  },
  en_curso: {
    texto: "En curso",
    icono: Loader2Icon,
    clase:
      "border-sky-600/40 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  completada: {
    texto: "Completada",
    icono: CheckCircle2Icon,
    clase:
      "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  completado: {
    texto: "Completado",
    icono: CheckCircle2Icon,
    clase:
      "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  error: {
    texto: "Con errores",
    icono: AlertTriangleIcon,
    clase:
      "border-red-600/40 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
}

/** Estado con icono + texto: nunca depende solo del color. */
export function EstadoBadge({
  estado,
  texto,
  className,
}: {
  estado: Estado
  texto?: string
  className?: string
}) {
  const e = ESTADOS[estado]
  const Icono = e.icono
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        e.clase,
        className
      )}
    >
      <Icono
        aria-hidden
        className={cn("size-3.5", estado === "en_curso" && "animate-spin")}
      />
      {texto ?? e.texto}
    </span>
  )
}

const numero = new Intl.NumberFormat("es-ES")
const decimal = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

export const fmtN = (n: number) => numero.format(n)
export const fmtD = (n: number) => decimal.format(n)

export function fmtMs(ms: number | undefined) {
  if (ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2).replace(".", ",")} s`
}

/** Siempre en UTC, sin depender del huso del navegador. */
export function fmtFechaUtc(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** Muestra un valor original tal cual, distinguiendo null, "" y ausente. */
export function ValorCrudo({ valor }: { valor: unknown }) {
  if (valor === undefined)
    return (
      <span className="text-red-700 italic dark:text-red-300">ausente</span>
    )
  if (valor === null)
    return <span className="text-red-700 italic dark:text-red-300">null</span>
  if (valor === "")
    return (
      <span className="text-red-700 italic dark:text-red-300">
        {'"" (vacío)'}
      </span>
    )
  if (typeof valor === "number") return <>{String(valor)}</>
  return <span className="font-mono">{JSON.stringify(valor)}</span>
}

export interface Columna<T> {
  titulo: string
  /** Unidad mostrada en el encabezado. */
  unidad?: string
  alinear?: "derecha"
  celda: (fila: T) => React.ReactNode
}

export const TAM_PAGINA = 25

export function TablaPaginada<T>({
  filas,
  columnas,
  clave,
  vacio = "No hay filas que mostrar.",
  seleccion,
  etiqueta,
}: {
  filas: T[]
  columnas: Columna<T>[]
  clave: (fila: T) => string
  vacio?: string
  etiqueta: string
  seleccion?: {
    seleccionados: ReadonlySet<string>
    alternar: (id: string, marcado: boolean) => void
    alternarPagina: (ids: string[], marcado: boolean) => void
  }
}) {
  const [pagina, setPagina] = React.useState(0)
  const paginas = Math.max(1, Math.ceil(filas.length / TAM_PAGINA))
  // Si cambian los datos y la página queda fuera de rango, se ajusta.
  const actual = Math.min(pagina, paginas - 1)
  const visibles = filas.slice(
    actual * TAM_PAGINA,
    actual * TAM_PAGINA + TAM_PAGINA
  )
  const idsPagina = visibles.map(clave)
  const marcadosPagina = seleccion
    ? idsPagina.filter((id) => seleccion.seleccionados.has(id)).length
    : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label={etiqueta}>
          <TableHeader>
            <TableRow>
              {seleccion && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar las filas de esta página"
                    checked={
                      visibles.length > 0 && marcadosPagina === visibles.length
                    }
                    indeterminate={
                      marcadosPagina > 0 && marcadosPagina < visibles.length
                    }
                    disabled={visibles.length === 0}
                    onCheckedChange={(v) =>
                      seleccion.alternarPagina(idsPagina, v)
                    }
                  />
                </TableHead>
              )}
              {columnas.map((c) => (
                <TableHead
                  key={c.titulo}
                  className={cn(c.alinear === "derecha" && "text-right")}
                >
                  {c.titulo}
                  {c.unidad && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({c.unidad})
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnas.length + (seleccion ? 1 : 0)}
                  className="py-8 text-center text-muted-foreground"
                >
                  {vacio}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((f) => {
                const id = clave(f)
                const marcado = seleccion?.seleccionados.has(id) ?? false
                return (
                  <TableRow
                    key={id}
                    data-state={marcado ? "selected" : undefined}
                  >
                    {seleccion && (
                      <TableCell>
                        <Checkbox
                          aria-label={`Seleccionar ${id}`}
                          checked={marcado}
                          onCheckedChange={(v) => seleccion.alternar(id, v)}
                        />
                      </TableCell>
                    )}
                    {columnas.map((c) => (
                      <TableCell
                        key={c.titulo}
                        className={cn(
                          c.alinear === "derecha" && "text-right tabular-nums"
                        )}
                      >
                        {c.celda(f)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Paginacion
        pagina={actual}
        paginas={paginas}
        total={filas.length}
        alCambiar={setPagina}
      />
    </div>
  )
}

export function Paginacion({
  pagina,
  paginas,
  total,
  alCambiar,
  tam = TAM_PAGINA,
}: {
  pagina: number
  paginas: number
  total: number
  alCambiar: (p: number) => void
  tam?: number
}) {
  const desde = total === 0 ? 0 : pagina * tam + 1
  const hasta = Math.min(total, (pagina + 1) * tam)
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <span>
        Filas {fmtN(desde)}–{fmtN(hasta)} de {fmtN(total)} · página {pagina + 1}{" "}
        de {paginas}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={pagina === 0}
          onClick={() => alCambiar(pagina - 1)}
        >
          <ChevronLeftIcon aria-hidden /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pagina >= paginas - 1}
          onClick={() => alCambiar(pagina + 1)}
        >
          Siguiente <ChevronRightIcon aria-hidden />
        </Button>
      </div>
    </nav>
  )
}

export function Contador({
  titulo,
  valor,
  detalle,
  destacado,
}: {
  titulo: string
  valor: number
  detalle?: string
  destacado?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card px-3 py-2",
        destacado && "border-primary ring-1 ring-primary"
      )}
    >
      <span className="text-xs text-muted-foreground">{titulo}</span>
      <span className="text-xl font-semibold tabular-nums">{fmtN(valor)}</span>
      {detalle && (
        <span className="text-xs text-muted-foreground">{detalle}</span>
      )}
    </div>
  )
}

export function descargarJson(nombre: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
