"use client"

import * as React from "react"
import { AnimatePresence } from "motion/react"
import { Map, MapProvider } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"

import { Configuracion } from "@/components/etl/configuracion"
import { ID_MAPA, useCamara } from "@/hooks/use-camara"
import { usePipelineEtl, type PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { useEstadoMapa } from "@/lib/mapa/estado"
import {
  ESTILO_MAPA,
  indexarMediciones,
  puntosEn,
  type IndiceMediciones,
} from "@/lib/mapa/mediciones"
import type { BBox, PuntoMapa } from "@/lib/mapa/tipos"

import { BarraSuperior } from "./barra-superior"
import { CustomMarker, type EstadoMarcador } from "./custom-marker"
import { DetalleCiudad } from "./detalle-ciudad"
import { DockAcciones } from "./dock-acciones"
import { FloatingPanel } from "./floating-panel"
import { LineaTiempo } from "./linea-tiempo"
import { PanelInspeccion } from "./panel-inspeccion"
import { TiraFases } from "./tira-fases"

const VISTA_GENERAL: BBox = [
  Math.min(...CIUDADES.map((c) => c.longitud)),
  Math.min(...CIUDADES.map((c) => c.latitud)),
  Math.max(...CIUDADES.map((c) => c.longitud)),
  Math.max(...CIUDADES.map((c) => c.latitud)),
]

const idPorNombre = (nombre: string) => CIUDADES.find((c) => c.nombre === nombre)?.id

export function MapLayout() {
  return (
    <MapProvider>
      {/* .dark + .tema-mapa: paleta oscura y superficies translúcidas solo aquí. */}
      <div className="dark tema-mapa relative h-dvh w-screen overflow-hidden bg-zinc-950 text-foreground">
        <Escena />
      </div>
    </MapProvider>
  )
}

function Escena() {
  const etl = usePipelineEtl()
  const validos = etl.etl?.limpieza.validos
  const indice = React.useMemo(() => indexarMediciones(validos ?? []), [validos])

  // Hora mostrada en el mapa. null = la última disponible.
  const [elegido, setElegido] = React.useState<string | null>(null)
  const posicion = elegido ? indice.instantes.indexOf(elegido) : -1
  const idx = posicion >= 0 ? posicion : indice.instantes.length - 1
  const instante = indice.instantes[idx] ?? null
  const puntos = React.useMemo(() => puntosEn(indice, instante), [indice, instante])

  // Estado de cada ciudad en la extracción → animación de su marcador.
  const estados = React.useMemo(() => {
    const r: Record<string, EstadoMarcador> = {}
    for (const c of CIUDADES) {
      const e = etl.extraccion?.porCiudad[c.id]?.estado
      r[c.nombre] =
        e === "en_curso" || e === "pendiente" ? "cargando" : e === "error" ? "error" : "reposo"
    }
    return r
  }, [etl.extraccion])

  const seleccionar = useEstadoMapa((s) => s.seleccionar)
  const panel = useEstadoMapa((s) => s.panel)

  return (
    <>
      <Map
        id={ID_MAPA}
        mapStyle={ESTILO_MAPA}
        initialViewState={{
          bounds: VISTA_GENERAL,
          fitBoundsOptions: { padding: margenInicial() },
        }}
        style={{ position: "absolute", inset: 0 }}
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        onClick={() => panel === "detalle" && seleccionar(null)}
      >
        <CapaMarcadores puntos={puntos} estados={estados} ciudadesSel={etl.ciudadesSel} />
      </Map>

      <CapaFlotante
        etl={etl}
        indice={indice}
        idx={idx}
        instante={instante}
        puntos={puntos}
        onElegirInstante={setElegido}
      />
    </>
  )
}

function margenInicial() {
  if (typeof window === "undefined" || !window.matchMedia("(min-width: 768px)").matches) {
    return 60
  }
  return { top: 100, bottom: 180, left: 440, right: 100 }
}

/** Conecta los marcadores con el store; CustomMarker sigue siendo puro. */
const CapaMarcadores = React.memo(function CapaMarcadores({
  puntos,
  estados,
  ciudadesSel,
}: {
  puntos: PuntoMapa[]
  estados: Record<string, EstadoMarcador>
  ciudadesSel: string[]
}) {
  const seleccionada = useEstadoMapa((s) => s.seleccionada)
  const sobrevolada = useEstadoMapa((s) => s.sobrevolada)
  const seleccionar = useEstadoMapa((s) => s.seleccionar)
  const sobrevolar = useEstadoMapa((s) => s.sobrevolar)
  const { volarA } = useCamara()

  const alSeleccionar = React.useCallback(
    (ciudad: string) => {
      const c = CIUDADES.find((x) => x.nombre === ciudad)
      seleccionar(ciudad)
      if (c) volarA(c.longitud, c.latitud)
    },
    [seleccionar, volarA]
  )

  return puntos.map((p) => (
    <CustomMarker
      key={p.ciudad}
      punto={p}
      estado={estados[p.ciudad]}
      activo={seleccionada === p.ciudad}
      resaltado={sobrevolada === p.ciudad}
      atenuado={!ciudadesSel.includes(idPorNombre(p.ciudad) ?? "")}
      onSeleccionar={alSeleccionar}
      onResaltar={sobrevolar}
    />
  ))
})

interface PropsCapa {
  etl: PipelineEtl
  indice: IndiceMediciones
  idx: number
  instante: string | null
  puntos: PuntoMapa[]
  onElegirInstante: (instante: string) => void
}

/**
 * Toda la UI del pipeline vive aquí, encima del mapa. El contenedor no captura
 * eventos (pointer-events-none) y cada pieza los reactiva: el mapa se puede
 * arrastrar por cualquier hueco libre.
 */
function CapaFlotante({ etl, indice, idx, instante, puntos, onElegirInstante }: PropsCapa) {
  // Selectores sueltos: un hover (sobrevolada) no re-renderiza esta capa.
  const seleccionada = useEstadoMapa((s) => s.seleccionada)
  const panel = useEstadoMapa((s) => s.panel)
  const pestana = useEstadoMapa((s) => s.pestana)
  const configAbierta = useEstadoMapa((s) => s.configAbierta)
  const seleccionar = useEstadoMapa((s) => s.seleccionar)
  const inspeccionar = useEstadoMapa((s) => s.inspeccionar)
  const cerrarPanel = useEstadoMapa((s) => s.cerrarPanel)
  const alternarConfig = useEstadoMapa((s) => s.alternarConfig)
  const { volarA, encuadrar, zoom } = useCamara()

  const punto = puntos.find((p) => p.ciudad === seleccionada) ?? null
  const idSeleccionada = seleccionada ? idPorNombre(seleccionada) : undefined
  const enCurso = !!etl.extraccion?.enCurso
  const bloqueado = etl.carga !== null && etl.carga.estado !== "terminada"
  const cerrarConfig = React.useCallback(() => alternarConfig(false), [alternarConfig])

  function extraer() {
    void etl.extraer()
    // Se ven todas las ciudades mientras se descargan.
    encuadrar(VISTA_GENERAL)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-5">
      <BarraSuperior
        onExplorar={(ciudad, lng, lat) => {
          seleccionar(ciudad)
          volarA(lng, lat)
        }}
      />

      <div className="relative flex min-h-0 flex-1 items-end justify-between gap-3 md:items-stretch">
        {/* Izquierda: configuración de la extracción. */}
        <div className="absolute inset-0 flex items-end md:static md:w-[380px] md:items-start">
          <FloatingPanel
            abierto={configAbierta}
            lado="izquierda"
            titulo="1 · Configuración de extracción"
            descripcion="Elige ciudades y fechas; los marcadores muestran el progreso."
            onCerrar={cerrarConfig}
            className="max-h-[55vh] w-full md:max-h-full"
          >
            <div className="p-5">
              <Configuracion
                ciudadesSel={etl.ciudadesSel}
                setCiudadesSel={etl.setCiudadesSel}
                inicio={etl.inicio}
                fin={etl.fin}
                setInicio={etl.setInicio}
                setFin={etl.setFin}
                validacion={etl.validacion}
                enCurso={enCurso}
                bloqueado={bloqueado}
                alExtraer={extraer}
                ciudades={etl.ciudadesEstado}
                alReintentar={etl.reintentarCiudad}
                hayDatosPrevios={!!etl.extraccion}
              />
            </div>
          </FloatingPanel>
        </div>

        {/* Derecha: detalle de ciudad o inspección de datos. */}
        <div className="absolute inset-0 flex items-end justify-end md:static md:min-w-0 md:flex-1 md:items-start">
          <DetalleCiudad
            punto={panel === "detalle" ? punto : null}
            serie={seleccionada ? (indice.porCiudad.get(seleccionada) ?? []) : []}
            instante={instante}
            extraccion={idSeleccionada ? etl.extraccion?.porCiudad[idSeleccionada] : undefined}
            incluida={!!idSeleccionada && etl.ciudadesSel.includes(idSeleccionada)}
            onCerrar={cerrarPanel}
            onCentrar={(p) => volarA(p.longitud, p.latitud)}
            onIrAInstante={onElegirInstante}
            onVerRegistros={(ciudad) => {
              etl.setFiltros({ ...etl.filtros, ciudades: [ciudad] })
              inspeccionar("validos")
            }}
            onAlternarInclusion={(ciudad) => {
              const id = idPorNombre(ciudad)!
              etl.setCiudadesSel(
                etl.ciudadesSel.includes(id)
                  ? etl.ciudadesSel.filter((x) => x !== id)
                  : [...etl.ciudadesSel, id]
              )
            }}
          />
          <FloatingPanel
            abierto={panel === "inspeccion"}
            titulo="Inspección de datos"
            descripcion="Resultado de cada fase, filtros, selección y carga en Supabase."
            onCerrar={cerrarPanel}
            className="max-h-[70vh] w-full md:max-h-full md:w-[min(760px,calc(100vw-2.5rem))]"
          >
            <PanelInspeccion p={etl} pestana={pestana} onPestana={inspeccionar} />
          </FloatingPanel>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <AnimatePresence>
          {indice.instantes.length > 1 && (
            <LineaTiempo
              key="linea-tiempo"
              instantes={indice.instantes}
              indice={idx}
              onCambiar={(i) => onElegirInstante(indice.instantes[i])}
            />
          )}
        </AnimatePresence>
        <div className="flex w-full flex-wrap items-end justify-center gap-2">
          <TiraFases
            fases={etl.fases}
            activa={panel === "inspeccion" ? pestana : null}
            onInspeccionar={inspeccionar}
          />
          <DockAcciones
            onZoom={zoom}
            onVistaGeneral={() => encuadrar(VISTA_GENERAL)}
            configAbierta={configAbierta}
            onConfig={() => alternarConfig()}
            onExtraer={extraer}
            extrayendo={enCurso}
            extraerDeshabilitado={etl.validacion.errores.length > 0 || enCurso || bloqueado}
          />
        </div>
      </div>
    </div>
  )
}
