"use client"

import * as React from "react"
import { DatabaseIcon, LaptopIcon, RefreshCwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"

import { fmtD, fmtFechaUtc, fmtN, Paginacion } from "./comun"

interface FilaPersistida {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

const TAM = 25
const ORDENES = [
  ["fecha_hora", "Fecha y hora"],
  ["ciudad", "Ciudad"],
  ["temperatura_c", "Temperatura"],
  ["humedad_pct", "Humedad"],
  ["precipitacion_mm", "Precipitación"],
  ["importado_en", "Importado en"],
] as const

const claseSelect =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

/** "AAAA-MM-DDTHH:MM" (UTC) → ISO, o "" */
const aIso = (v: string) => (v ? `${v}:00Z` : "")

export function PestanaSupabase({
  pendientesLocales,
}: {
  pendientesLocales: number
}) {
  const [estado, setEstado] = React.useState<{
    listo: boolean
    mensaje: string
  } | null>(null)
  const [ciudades, setCiudades] = React.useState<string[]>([])
  const [desde, setDesde] = React.useState("")
  const [hasta, setHasta] = React.useState("")
  const [orden, setOrden] = React.useState("fecha_hora")
  const [dir, setDir] = React.useState<"asc" | "desc">("asc")
  const [pagina, setPagina] = React.useState(0)
  const [datos, setDatos] = React.useState<{
    filas: FilaPersistida[]
    total: number
  } | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [leidoEn, setLeidoEn] = React.useState<Date>()

  const consultar = React.useCallback(async () => {
    setCargando(true)
    setError(undefined)
    try {
      const est = await fetch("/api/estado").then((r) => r.json())
      setEstado(est)
      if (!est.listo) {
        setDatos(null)
        return
      }
      const p = new URLSearchParams({
        ciudades: ciudades.join(","),
        desde: aIso(desde),
        hasta: aIso(hasta),
        orden,
        dir,
        pagina: String(pagina),
        tam: String(TAM),
      })
      const r = await fetch(`/api/datos?${p}`)
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? `HTTP ${r.status}`)
      setDatos(cuerpo)
      setLeidoEn(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }, [ciudades, desde, hasta, orden, dir, pagina])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura remota al cambiar la consulta
    void consultar()
  }, [consultar])

  const paginas = Math.max(1, Math.ceil((datos?.total ?? 0) / TAM))
  const conFiltro =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v)
      setPagina(0)
    }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
          <LaptopIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Local, pendiente de subir:</strong>{" "}
            {fmtN(pendientesLocales)} registros seleccionados en este navegador.
            Desaparecen si recargas la página.
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
          <DatabaseIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Persistido en Supabase:</strong>{" "}
            {datos
              ? `${fmtN(datos.total)} registros con los filtros de esta pestaña`
              : "—"}
            . Lectura real de la tabla <code>mediciones_meteorologicas</code>.
          </p>
        </div>
      </div>

      {estado && !estado.listo && (
        <Alert variant="destructive">
          <AlertTitle>Destino no disponible</AlertTitle>
          <AlertDescription>{estado.mensaje}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error al leer Supabase</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs font-medium">
            Ciudades (ninguna marcada = todas)
          </legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {NOMBRES_CIUDADES.map((c) => (
              <div key={c} className="flex items-center gap-1.5">
                <Checkbox
                  id={`sb-${c}`}
                  checked={ciudades.includes(c)}
                  onCheckedChange={conFiltro((v: boolean) =>
                    setCiudades(
                      v ? [...ciudades, c] : ciudades.filter((x) => x !== c)
                    )
                  )}
                />
                <Label htmlFor={`sb-${c}`} className="font-normal">
                  {c}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sb-desde" className="text-xs">
            Desde (UTC)
          </Label>
          <Input
            id="sb-desde"
            type="datetime-local"
            value={desde}
            onChange={(e) => conFiltro(setDesde)(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sb-hasta" className="text-xs">
            Hasta (UTC)
          </Label>
          <Input
            id="sb-hasta"
            type="datetime-local"
            value={hasta}
            onChange={(e) => conFiltro(setHasta)(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sb-orden" className="text-xs">
            ORDER BY
          </Label>
          <div className="flex gap-1">
            <select
              id="sb-orden"
              className={claseSelect}
              value={orden}
              onChange={(e) => conFiltro(setOrden)(e.target.value)}
            >
              {ORDENES.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
            <select
              aria-label="Dirección"
              className={claseSelect}
              value={dir}
              onChange={(e) =>
                conFiltro(setDir)(e.target.value as "asc" | "desc")
              }
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => void consultar()}
          disabled={cargando}
        >
          <RefreshCwIcon
            aria-hidden
            className={cargando ? "animate-spin" : undefined}
          />
          {cargando ? "Consultando…" : "Actualizar"}
        </Button>
        {leidoEn && (
          <span className="text-xs text-muted-foreground">
            Última lectura: {leidoEn.toLocaleTimeString("es-ES")}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label="Registros almacenados en Supabase">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">id</TableHead>
              <TableHead>ciudad</TableHead>
              <TableHead>
                fecha_hora{" "}
                <span className="font-normal text-muted-foreground">(UTC)</span>
              </TableHead>
              <TableHead className="text-right">
                temperatura_c{" "}
                <span className="font-normal text-muted-foreground">(°C)</span>
              </TableHead>
              <TableHead className="text-right">
                humedad_pct{" "}
                <span className="font-normal text-muted-foreground">(%)</span>
              </TableHead>
              <TableHead className="text-right">
                precipitacion_mm{" "}
                <span className="font-normal text-muted-foreground">(mm)</span>
              </TableHead>
              <TableHead>
                importado_en{" "}
                <span className="font-normal text-muted-foreground">(UTC)</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!datos || datos.filas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  {cargando
                    ? "Consultando…"
                    : "No hay registros persistidos con estos filtros."}
                </TableCell>
              </TableRow>
            ) : (
              datos.filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-right tabular-nums">
                    {f.id}
                  </TableCell>
                  <TableCell>{f.ciudad}</TableCell>
                  <TableCell>{fmtFechaUtc(f.fecha_hora)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtD(f.temperatura_c)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtN(f.humedad_pct)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtD(f.precipitacion_mm)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmtFechaUtc(f.importado_en)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Paginacion
        pagina={Math.min(pagina, paginas - 1)}
        paginas={paginas}
        total={datos?.total ?? 0}
        alCambiar={setPagina}
        tam={TAM}
      />
    </div>
  )
}
