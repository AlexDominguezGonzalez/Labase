"use client"

import { ArrowDownIcon, ArrowUpIcon, FilterXIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  filtrosIniciales,
  type CampoOrden,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtrado"
import type { RegistroValido } from "@/lib/etl/tipos"

import { fmtD, fmtFechaUtc, fmtN, TablaPaginada, type Columna } from "./comun"
import { Vacio } from "./inspeccion"

export const COLUMNAS_VALIDOS: Columna<RegistroValido>[] = [
  { titulo: "Ciudad", celda: (r) => r.ciudad },
  {
    titulo: "Fecha y hora",
    unidad: "UTC",
    celda: (r) => fmtFechaUtc(r.fecha_hora),
  },
  {
    titulo: "Temperatura",
    unidad: "°C",
    alinear: "derecha",
    celda: (r) => fmtD(r.temperatura_c),
  },
  {
    titulo: "Humedad",
    unidad: "%",
    alinear: "derecha",
    celda: (r) => fmtN(r.humedad_pct),
  },
  {
    titulo: "Precipitación",
    unidad: "mm",
    alinear: "derecha",
    celda: (r) => fmtD(r.precipitacion_mm),
  },
]

const CAMPOS: { valor: CampoOrden; texto: string }[] = [
  { valor: "ciudad", texto: "Ciudad" },
  { valor: "fecha_hora", texto: "Fecha y hora" },
  { valor: "temperatura_c", texto: "Temperatura" },
  { valor: "humedad_pct", texto: "Humedad" },
  { valor: "precipitacion_mm", texto: "Precipitación" },
]

const claseSelect =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export function PanelFiltros({
  ciudadesDisponibles,
  filtros,
  setFiltros,
  errores,
  orden,
  setOrden,
  ordenados,
  totalValidos,
  seleccion,
  setSeleccion,
  fueraDeFiltros,
  aCargar,
}: {
  ciudadesDisponibles: string[]
  filtros: Filtros
  setFiltros: (f: Filtros | ((f: Filtros) => Filtros)) => void
  errores: string[]
  orden: Orden
  setOrden: (o: Orden) => void
  ordenados: RegistroValido[]
  totalValidos: number
  seleccion: ReadonlySet<string>
  setSeleccion: (
    s: ReadonlySet<string> | ((s: ReadonlySet<string>) => ReadonlySet<string>)
  ) => void
  fueraDeFiltros: number
  aCargar: number
}) {
  if (totalValidos === 0)
    return <Vacio texto="No hay registros válidos todavía." />

  const cambiar = (campo: keyof Filtros, valor: string | boolean | string[]) =>
    setFiltros((f) => ({ ...f, [campo]: valor }))

  const rango = (
    titulo: string,
    unidad: string,
    min: "tempMin" | "humMin" | "precMin",
    max: "tempMax" | "humMax" | "precMax"
  ) => (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-xs font-medium">
        {titulo} ({unidad})
      </legend>
      <div className="flex items-center gap-1">
        <Input
          aria-label={`${titulo} mínima`}
          inputMode="decimal"
          placeholder="mín."
          value={filtros[min]}
          onChange={(e) => cambiar(min, e.target.value)}
        />
        <span aria-hidden>–</span>
        <Input
          aria-label={`${titulo} máxima`}
          inputMode="decimal"
          placeholder="máx."
          value={filtros[max]}
          onChange={(e) => cambiar(max, e.target.value)}
        />
      </div>
    </fieldset>
  )

  function seleccionarFiltrados() {
    setSeleccion((s) => {
      const n = new Set(s)
      for (const r of ordenados) n.add(r.id)
      return n
    })
  }
  function quitarFueraDeFiltros() {
    const visibles = new Set(ordenados.map((r) => r.id))
    setSeleccion((s) => new Set([...s].filter((id) => visibles.has(id))))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Orden de operaciones:{" "}
        <strong>válidos → filtros → ordenación → selección → carga</strong>. Los
        filtros y la ordenación se aplican a <em>todos</em> los registros
        válidos antes de paginar; la paginación solo afecta a lo que ves.
      </p>

      <div className="grid gap-4 rounded-lg border p-3 md:grid-cols-2 xl:grid-cols-4">
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs font-medium">Ciudades</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {ciudadesDisponibles.map((c) => (
              <div key={c} className="flex items-center gap-1.5">
                <Checkbox
                  id={`filtro-${c}`}
                  checked={filtros.ciudades.includes(c)}
                  onCheckedChange={(v) =>
                    cambiar(
                      "ciudades",
                      v
                        ? [...filtros.ciudades, c]
                        : filtros.ciudades.filter((x) => x !== c)
                    )
                  }
                />
                <Label htmlFor={`filtro-${c}`} className="font-normal">
                  {c}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs font-medium">
            Intervalo de fecha y hora (UTC)
          </legend>
          <div className="flex flex-col gap-1">
            <Input
              type="datetime-local"
              aria-label="Desde (UTC)"
              value={filtros.desde}
              onChange={(e) => cambiar("desde", e.target.value)}
            />
            <Input
              type="datetime-local"
              aria-label="Hasta (UTC)"
              value={filtros.hasta}
              onChange={(e) => cambiar("hasta", e.target.value)}
            />
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          {rango("Temperatura", "°C", "tempMin", "tempMax")}
          {rango("Humedad", "%", "humMin", "humMax")}
        </div>

        <div className="flex flex-col gap-2">
          {rango("Precipitación", "mm", "precMin", "precMax")}
          <div className="flex items-center gap-2">
            <Checkbox
              id="solo-lluvia"
              checked={filtros.soloLluvia}
              onCheckedChange={(v) => cambiar("soloLluvia", v)}
            />
            <Label htmlFor="solo-lluvia" className="font-normal">
              Solo registros con lluvia (precipitación &gt; 0)
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="orden-campo" className="text-xs">
              Ordenar por
            </Label>
            <select
              id="orden-campo"
              className={claseSelect}
              value={orden.campo}
              onChange={(e) =>
                setOrden({ ...orden, campo: e.target.value as CampoOrden })
              }
            >
              {CAMPOS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.texto}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setOrden({
                ...orden,
                direccion: orden.direccion === "asc" ? "desc" : "asc",
              })
            }
          >
            {orden.direccion === "asc" ? (
              <>
                <ArrowUpIcon aria-hidden /> Ascendente
              </>
            ) : (
              <>
                <ArrowDownIcon aria-hidden /> Descendente
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setFiltros(filtrosIniciales(ciudadesDisponibles))}
          >
            <FilterXIcon aria-hidden /> Restablecer filtros
          </Button>
        </div>
      </div>

      {errores.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>{errores.join(" ")}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm tabular-nums" aria-live="polite">
          <strong>{fmtN(ordenados.length)}</strong> de {fmtN(totalValidos)}{" "}
          válidos coinciden con los filtros · <strong>{fmtN(aCargar)}</strong>{" "}
          seleccionados para cargar
          {fueraDeFiltros > 0 && (
            <span className="text-amber-800 dark:text-amber-300">
              {" "}
              · ⚠ {fmtN(fueraDeFiltros)} seleccionados quedan fuera de los
              filtros y no se subirán
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={seleccionarFiltrados}
            disabled={ordenados.length === 0}
          >
            Seleccionar los {fmtN(ordenados.length)} filtrados
          </Button>
          {fueraDeFiltros > 0 && (
            <Button size="sm" variant="outline" onClick={quitarFueraDeFiltros}>
              Quitar los fuera de filtros
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSeleccion(new Set())}
            disabled={seleccion.size === 0}
          >
            Vaciar selección
          </Button>
        </div>
      </div>

      <TablaPaginada
        etiqueta="Registros válidos filtrados y ordenados"
        filas={ordenados}
        columnas={COLUMNAS_VALIDOS}
        clave={(r) => r.id}
        vacio="Ningún registro válido cumple los filtros actuales."
        seleccion={{
          seleccionados: seleccion,
          alternar: (id, v) =>
            setSeleccion((s) => {
              const n = new Set(s)
              if (v) n.add(id)
              else n.delete(id)
              return n
            }),
          alternarPagina: (ids, v) =>
            setSeleccion((s) => {
              const n = new Set(s)
              for (const id of ids) {
                if (v) n.add(id)
                else n.delete(id)
              }
              return n
            }),
        }}
      />
    </div>
  )
}
