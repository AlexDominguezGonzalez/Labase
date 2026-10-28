"use client"

import * as React from "react"
import { ArrowRightIcon, DatabaseIcon, InfoIcon, MapIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { crearLotes, ejecutarLotes, huella, type Lote } from "@/lib/etl/carga"
import { CIUDADES, ciudadPorId } from "@/lib/etl/ciudades"
import {
  construirUrl,
  descargarCiudad,
  FECHA_FINAL_DEFECTO,
  FECHA_INICIAL_DEFECTO,
  validarConfiguracion,
} from "@/lib/etl/extraccion"
import {
  aFilaCarga,
  conjuntoDeCarga,
  erroresFiltros,
  filtrosIniciales,
  ORDEN_DEFECTO,
  seleccionFueraDeFiltros,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtrado"
import { filtrarYOrdenar, transformarYLimpiar } from "@/lib/etl/pipeline"
import type { ExtraccionCiudad, FilaCarga } from "@/lib/etl/tipos"

import { Contador, EstadoBadge, fmtMs, fmtN, type Estado } from "./comun"
import { Configuracion } from "./configuracion"
import {
  PestanaJson,
  PestanaRechazados,
  PestanaTransformados,
} from "./inspeccion"
import { PanelCarga, type EstadoCarga, type Verificacion } from "./panel-carga"
import { PanelFiltros } from "./panel-filtros"
import { PestanaMapa } from "./pestana-mapa"
import { PestanaSupabase } from "./pestana-supabase"

interface EstadoExtraccion {
  inicio: string
  fin: string
  ciudades: string[]
  porCiudad: Record<string, ExtraccionCiudad>
  enCurso: boolean
  duracionMs?: number
}

/** Referencia estable: un [] nuevo en cada render recrearía los marcadores. */
const SIN_FILAS: FilaCarga[] = []

type Pestana =
  | "json"
  | "transformados"
  | "validos"
  | "rechazados"
  | "carga"
  | "supabase"
  | "mapa"

export function PipelineEtl() {
  // ---------- 1. Configuración ----------
  const [ciudadesSel, setCiudadesSel] = React.useState<string[]>(
    CIUDADES.map((c) => c.id)
  )
  const [inicio, setInicio] = React.useState(FECHA_INICIAL_DEFECTO)
  const [fin, setFin] = React.useState(FECHA_FINAL_DEFECTO)
  const validacion = validarConfiguracion(ciudadesSel, inicio, fin)

  // ---------- 2. Extracción ----------
  const [extraccion, setExtraccion] = React.useState<EstadoExtraccion | null>(
    null
  )
  const [duracionReintento, setDuracionReintento] = React.useState<number>()

  const actualizarCiudad = React.useCallback(
    (id: string, cambios: Partial<ExtraccionCiudad>) =>
      setExtraccion((e) =>
        e
          ? {
              ...e,
              porCiudad: {
                ...e.porCiudad,
                [id]: { ...e.porCiudad[id], ...cambios },
              },
            }
          : e
      ),
    []
  )

  const descargarUna = React.useCallback(
    async (id: string, url: string, intentosPrevios: number) => {
      actualizarCiudad(id, {
        estado: "en_curso",
        error: undefined,
        intentos: intentosPrevios + 1,
      })
      const t = performance.now()
      try {
        const json = await descargarCiudad(url)
        actualizarCiudad(id, {
          estado: "completada",
          json,
          duracionMs: performance.now() - t,
        })
        return true
      } catch (e) {
        actualizarCiudad(id, {
          estado: "error",
          error: e instanceof Error ? e.message : String(e),
          duracionMs: performance.now() - t,
          json: undefined,
        })
        return false
      }
    },
    [actualizarCiudad]
  )

  // ---------- 3–4. Transformación y limpieza (derivadas, con duración real) ----------
  const etl = React.useMemo(
    () =>
      extraccion
        ? transformarYLimpiar(
            extraccion.ciudades.map((id) => extraccion.porCiudad[id])
          )
        : null,
    [extraccion]
  )

  // ---------- 5. Filtros → ordenación → selección ----------
  const ciudadesExtraidas = React.useMemo(
    () =>
      extraccion
        ? extraccion.ciudades.map((id) => ciudadPorId(id)!.nombre)
        : [],
    [extraccion]
  )
  const [filtros, setFiltros] = React.useState<Filtros>(filtrosIniciales([]))
  const [orden, setOrden] = React.useState<Orden>(ORDEN_DEFECTO)
  const [seleccion, setSeleccion] = React.useState<ReadonlySet<string>>(
    new Set()
  )
  const errFiltros = erroresFiltros(filtros)

  const filtrado = React.useMemo(
    () => filtrarYOrdenar(etl?.limpieza.validos ?? [], filtros, orden),
    [etl, filtros, orden]
  )

  const aCargar = React.useMemo(
    () => conjuntoDeCarga(filtrado.ordenados, seleccion),
    [filtrado, seleccion]
  )
  const fueraDeFiltros = seleccionFueraDeFiltros(filtrado.ordenados, seleccion)
  const filasVistaPrevia = React.useMemo(
    () => aCargar.map(aFilaCarga),
    [aCargar]
  )

  // ---------- 6. Carga ----------
  const [carga, setCarga] = React.useState<EstadoCarga | null>(null)
  const enviando = React.useRef(false)

  async function enviarLote(filas: FilaCarga[]) {
    const r = await fetch("/api/carga", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registros: filas }),
    })
    const cuerpo = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(cuerpo.error ?? `HTTP ${r.status}`)
    return { procesadas: Number(cuerpo.procesadas) || 0 }
  }

  async function verificar(lotes: Lote[]): Promise<Verificacion> {
    const completados = lotes.filter((l) => l.estado === "completado")
    let comprobadas = 0
    let encontradas = 0
    const faltan: { ciudad: string; fecha_hora: string }[] = []
    try {
      for (const l of completados) {
        const r = await fetch("/api/verificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claves: l.filas.map((f) => ({
              ciudad: f.ciudad,
              fecha_hora: f.fecha_hora,
            })),
          }),
        })
        const cuerpo = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(cuerpo.error ?? `HTTP ${r.status}`)
        comprobadas += cuerpo.comprobadas
        encontradas += cuerpo.encontradas
        faltan.push(...cuerpo.faltan)
      }
      return {
        estado: faltan.length ? "error" : "completada",
        comprobadas,
        encontradas,
        faltan,
      }
    } catch (e) {
      return {
        estado: "error",
        comprobadas,
        encontradas,
        faltan,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  async function procesarLotes(lotes: Lote[]) {
    const t0 = performance.now()
    setCarga((c) => c && { ...c, estado: "enviando", verificacion: undefined })
    const final = await ejecutarLotes(lotes, enviarLote, (l) =>
      setCarga((c) => c && { ...c, lotes: l })
    )
    setCarga((c) => c && { ...c, estado: "verificando" })
    const verificacion = await verificar(final)
    setCarga(
      (c) =>
        c && {
          ...c,
          estado: "terminada",
          verificacion,
          duracionMs: performance.now() - t0,
        }
    )
    enviando.current = false
  }

  function subir() {
    // Prevención de envíos simultáneos: la ref se comprueba de forma síncrona.
    if (enviando.current || filasVistaPrevia.length === 0) return
    enviando.current = true
    // Copia congelada del conjunto y su orden en el momento del clic.
    const lotes = crearLotes(filasVistaPrevia)
    const congeladas = lotes.flatMap((l) => l.filas)
    setCarga({
      lotes,
      total: congeladas.length,
      huella: huella(congeladas),
      estado: "enviando",
    })
    void procesarLotes(lotes)
  }

  function reintentarFallidos() {
    if (enviando.current || !carga) return
    enviando.current = true
    void procesarLotes(carga.lotes)
  }

  // ---------- Acciones de extracción ----------
  async function extraer() {
    if (validacion.errores.length || extraccion?.enCurso || enviando.current)
      return
    const ids = CIUDADES.map((c) => c.id).filter((id) =>
      ciudadesSel.includes(id)
    )
    const porCiudad: Record<string, ExtraccionCiudad> = {}
    for (const id of ids) {
      porCiudad[id] = {
        ciudadId: id,
        estado: "pendiente",
        url: construirUrl(ciudadPorId(id)!, inicio, fin),
        intentos: 0,
      }
    }
    setExtraccion({ inicio, fin, ciudades: ids, porCiudad, enCurso: true })
    setDuracionReintento(undefined)
    // Una extracción nueva empieza de cero: ni selección ni carga previas.
    setSeleccion(new Set())
    setCarga(null)
    setFiltros(filtrosIniciales(ids.map((id) => ciudadPorId(id)!.nombre)))
    setOrden(ORDEN_DEFECTO)
    const t0 = performance.now()
    await Promise.all(ids.map((id) => descargarUna(id, porCiudad[id].url, 0)))
    setExtraccion(
      (e) => e && { ...e, enCurso: false, duracionMs: performance.now() - t0 }
    )
  }

  async function reintentarCiudad(id: string) {
    if (!extraccion || extraccion.enCurso) return
    const c = extraccion.porCiudad[id]
    if (c.estado === "en_curso") return
    const t0 = performance.now()
    // Se sustituye el JSON de esa ciudad: no se acumulan datos duplicados.
    const ok = await descargarUna(id, c.url, c.intentos)
    setDuracionReintento(performance.now() - t0)
    const nombre = ciudadPorId(id)!.nombre
    if (ok) {
      setFiltros((f) =>
        f.ciudades.includes(nombre)
          ? f
          : { ...f, ciudades: [...f.ciudades, nombre] }
      )
    }
  }

  // ---------- Estado de cada fase (solo contadores reales) ----------
  const ciudadesEstado = extraccion
    ? extraccion.ciudades.map((id) => extraccion.porCiudad[id])
    : []
  const estadoExtraccion: Estado = !extraccion
    ? "pendiente"
    : ciudadesEstado.some(
          (c) => c.estado === "en_curso" || c.estado === "pendiente"
        )
      ? "en_curso"
      : ciudadesEstado.some((c) => c.estado === "error")
        ? "error"
        : "completada"
  const hayDatos = (etl?.respuestas ?? 0) > 0
  const validos = etl?.limpieza.validos.length ?? 0
  const rechazados = etl?.limpieza.rechazados.length ?? 0

  const estadoCargaFase: Estado = !carga
    ? "pendiente"
    : carga.estado !== "terminada"
      ? "en_curso"
      : carga.lotes.some((l) => l.estado === "error") ||
          carga.verificacion?.estado === "error"
        ? "error"
        : "completada"

  const fases: {
    nombre: string
    estado: Estado
    entrada: string
    salida: string
    explicacion: string
    duracion?: number
    pestana: Pestana
  }[] = [
    {
      nombre: "Extracción",
      estado: estadoExtraccion,
      entrada: extraccion ? `${extraccion.ciudades.length} peticiones` : "—",
      salida: etl ? `${fmtN(etl.filasRecibidas)} horas recibidas` : "—",
      explicacion:
        "Una petición HTTP por ciudad a la API histórica de Open-Meteo (UTC, °C, mm).",
      duracion: duracionReintento ?? extraccion?.duracionMs,
      pestana: "json",
    },
    {
      nombre: "Transformación",
      estado: !hayDatos
        ? "pendiente"
        : etl!.avisos.length
          ? "error"
          : "completada",
      entrada: hayDatos ? `${etl!.respuestas} respuestas JSON` : "—",
      salida: hayDatos ? `${fmtN(etl!.registros.length)} registros` : "—",
      explicacion:
        "Los arrays paralelos se convierten en una fila por ciudad y hora; fechas como UTC explícito.",
      duracion: hayDatos ? etl!.duracionTransformacion : undefined,
      pestana: "transformados",
    },
    {
      nombre: "Limpieza",
      estado: hayDatos ? "completada" : "pendiente",
      entrada: hayDatos ? `${fmtN(etl!.registros.length)} registros` : "—",
      salida: hayDatos
        ? `${fmtN(validos)} válidos · ${fmtN(rechazados)} rechazados`
        : "—",
      explicacion:
        "Valida tipos, nulos y rangos; elimina duplicados por (ciudad, fecha_hora).",
      duracion: hayDatos ? etl!.duracionLimpieza : undefined,
      pestana: "rechazados",
    },
    {
      nombre: "Filtrado y selección",
      estado: !hayDatos
        ? "pendiente"
        : errFiltros.length
          ? "error"
          : "completada",
      entrada: hayDatos ? `${fmtN(validos)} válidos` : "—",
      salida: hayDatos
        ? `${fmtN(filtrado.ordenados.length)} coinciden · ${fmtN(aCargar.length)} seleccionados`
        : "—",
      explicacion:
        "Filtros y orden elegidos por ti; solo se suben las filas seleccionadas que cumplen los filtros.",
      duracion: hayDatos ? filtrado.duracionMs : undefined,
      pestana: "validos",
    },
    {
      nombre: "Carga",
      estado: estadoCargaFase,
      entrada: carga
        ? `${fmtN(carga.total)} congelados en ${carga.lotes.length} ${carga.lotes.length === 1 ? "lote" : "lotes"}`
        : "—",
      salida: carga
        ? `${fmtN(carga.lotes.reduce((n, l) => n + (l.estado === "completado" ? (l.procesadas ?? 0) : 0), 0))} procesados`
        : "—",
      explicacion:
        "Upsert por lotes de 500 en Supabase desde el servidor y verificación posterior de claves.",
      duracion: carga?.duracionMs,
      pestana: "carga",
    },
  ]

  const [pestana, setPestana] = React.useState<Pestana>("json")
  const refPestanas = React.useRef<HTMLDivElement>(null)
  function inspeccionar(p: Pestana) {
    setPestana(p)
    refPestanas.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Especialización en Big Data · Práctica 1
        </p>
        <h1 className="text-2xl font-semibold">
          Pipeline ETL: Open-Meteo → Supabase
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Extrae mediciones horarias reales, observa cómo cambian los datos en
          cada fase y decide exactamente qué registros se cargan en la base de
          datos.
        </p>
      </header>

      {/* 1. CONFIGURACIÓN */}
      <Configuracion
        ciudadesSel={ciudadesSel}
        setCiudadesSel={setCiudadesSel}
        inicio={inicio}
        fin={fin}
        setInicio={setInicio}
        setFin={setFin}
        validacion={validacion}
        enCurso={!!extraccion?.enCurso}
        bloqueado={carga !== null && carga.estado !== "terminada"}
        alExtraer={extraer}
        ciudades={ciudadesEstado}
        alReintentar={reintentarCiudad}
        hayDatosPrevios={!!extraccion}
      />

      {/* 2. PIPELINE */}
      <section
        aria-labelledby="titulo-pipeline"
        className="flex flex-col gap-3"
      >
        <h2 id="titulo-pipeline" className="text-lg font-semibold">
          2. Pipeline
        </h2>
        <ol className="grid gap-3 md:grid-cols-5">
          {fases.map((f, i) => (
            <li key={f.nombre} className="relative flex">
              <Card size="sm" className="w-full">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="text-muted-foreground">{i + 1}.</span>{" "}
                      {f.nombre}
                    </span>
                    <EstadoBadge estado={f.estado} />
                  </CardTitle>
                  <CardDescription>{f.explicacion}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-col gap-2 text-xs">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                    <dt className="text-muted-foreground">Entrada</dt>
                    <dd className="tabular-nums">{f.entrada}</dd>
                    <dt className="text-muted-foreground">Salida</dt>
                    <dd className="tabular-nums">{f.salida}</dd>
                    <dt className="text-muted-foreground">Duración</dt>
                    <dd className="tabular-nums">{fmtMs(f.duracion)}</dd>
                  </dl>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => inspeccionar(f.pestana)}
                  >
                    Inspeccionar resultado
                  </Button>
                </CardContent>
              </Card>
              {i < fases.length - 1 && (
                <ArrowRightIcon
                  aria-hidden
                  className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground md:block"
                />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* CONTADORES */}
      <section
        aria-label="Contadores"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        <Contador
          titulo="Total extraído"
          valor={etl?.registros.length ?? 0}
          detalle="filas tras transformar"
        />
        <Contador
          titulo="Válidos"
          valor={validos}
          detalle="superan la limpieza"
        />
        <Contador
          titulo="Rechazados"
          valor={rechazados}
          detalle="por calidad o duplicado"
        />
        <Contador
          titulo="Coinciden con los filtros"
          valor={filtrado.ordenados.length}
          detalle="de los válidos"
        />
        <Contador
          titulo="Seleccionados para cargar"
          valor={aCargar.length}
          detalle={
            fueraDeFiltros
              ? `+${fmtN(fueraDeFiltros)} seleccionados fuera de filtros`
              : "cumplen los filtros"
          }
          destacado
        />
      </section>

      {/* 3. INSPECCIÓN */}
      <section
        ref={refPestanas}
        aria-labelledby="titulo-inspeccion"
        className="flex scroll-mt-4 flex-col gap-3"
      >
        <h2 id="titulo-inspeccion" className="text-lg font-semibold">
          3. Inspección de datos
        </h2>
        <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)}>
          <div className="overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="json">JSON original</TabsTrigger>
              <TabsTrigger value="transformados">
                Transformados ({fmtN(etl?.registros.length ?? 0)})
              </TabsTrigger>
              <TabsTrigger value="validos">
                Válidos y selección ({fmtN(validos)})
              </TabsTrigger>
              <TabsTrigger value="rechazados">
                Rechazados ({fmtN(rechazados)})
              </TabsTrigger>
              <TabsTrigger value="carga">
                Vista previa de la carga ({fmtN(aCargar.length)})
              </TabsTrigger>
              <TabsTrigger value="supabase">
                <DatabaseIcon aria-hidden /> Datos en Supabase
              </TabsTrigger>
              <TabsTrigger value="mapa">
                <MapIcon aria-hidden /> Mapa
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="json">
            <PestanaJson
              ciudades={ciudadesEstado}
              alReintentar={reintentarCiudad}
            />
          </TabsContent>
          <TabsContent value="transformados">
            <PestanaTransformados
              registros={etl?.registros ?? []}
              avisos={etl?.avisos ?? []}
            />
          </TabsContent>
          <TabsContent value="validos">
            <PanelFiltros
              ciudadesDisponibles={ciudadesExtraidas}
              filtros={filtros}
              setFiltros={setFiltros}
              errores={errFiltros}
              orden={orden}
              setOrden={setOrden}
              ordenados={filtrado.ordenados}
              totalValidos={validos}
              seleccion={seleccion}
              setSeleccion={setSeleccion}
              fueraDeFiltros={fueraDeFiltros}
              aCargar={aCargar.length}
            />
          </TabsContent>
          <TabsContent value="rechazados">
            <PestanaRechazados
              rechazados={etl?.limpieza.rechazados ?? []}
              duplicados={etl?.limpieza.duplicadosEliminados ?? 0}
            />
          </TabsContent>
          <TabsContent value="carga">
            <PanelCarga
              filas={filasVistaPrevia}
              huellaVistaPrevia={huella(filasVistaPrevia)}
              orden={orden}
              fueraDeFiltros={fueraDeFiltros}
              carga={carga}
              alSubir={subir}
              alReintentar={reintentarFallidos}
            />
          </TabsContent>
          <TabsContent value="supabase">
            <PestanaSupabase pendientesLocales={aCargar.length} />
          </TabsContent>
          <TabsContent value="mapa">
            <PestanaMapa filas={etl?.limpieza.validos ?? SIN_FILAS} />
          </TabsContent>
        </Tabs>
      </section>

      <footer className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
        <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Datos: Open-Meteo Historical Weather API (CC BY 4.0). La escritura en
          Supabase se ejecuta solo en el servidor. Sin autenticación: uso
          exclusivo en desarrollo local.
        </p>
      </footer>
    </div>
  )
}
