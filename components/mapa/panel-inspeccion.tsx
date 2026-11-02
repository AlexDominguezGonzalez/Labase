"use client"

import { DatabaseIcon } from "lucide-react"

import { Contador, fmtN } from "@/components/etl/comun"
import {
  PestanaJson,
  PestanaRechazados,
  PestanaTransformados,
} from "@/components/etl/inspeccion"
import { PanelCarga } from "@/components/etl/panel-carga"
import { PanelFiltros } from "@/components/etl/panel-filtros"
import { PestanaSupabase } from "@/components/etl/pestana-supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Pestana, PipelineEtl } from "@/hooks/use-pipeline-etl"

interface Props {
  p: PipelineEtl
  pestana: Pestana
  onPestana: (pestana: Pestana) => void
}

/**
 * Contadores + pestañas de inspección del pipeline, dentro de un panel flotante.
 * @container: las rejillas internas responden al ancho del panel, no de la ventana.
 */
export function PanelInspeccion({ p, pestana, onPestana }: Props) {
  return (
    <div className="@container flex flex-col gap-4 p-5">
      <section aria-label="Contadores" className="grid grid-cols-2 gap-2 @xl:grid-cols-5">
        <Contador titulo="Extraídos" valor={p.etl?.registros.length ?? 0} />
        <Contador titulo="Válidos" valor={p.validos} />
        <Contador titulo="Rechazados" valor={p.rechazados} />
        <Contador titulo="Coinciden" valor={p.filtrado.ordenados.length} />
        <Contador
          titulo="Para cargar"
          valor={p.aCargar.length}
          detalle={p.fueraDeFiltros ? `+${fmtN(p.fueraDeFiltros)} fuera de filtros` : undefined}
          destacado
        />
      </section>

      <Tabs value={pestana} onValueChange={(v) => onPestana(v as Pestana)}>
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="transformados">
              Transformados ({fmtN(p.etl?.registros.length ?? 0)})
            </TabsTrigger>
            <TabsTrigger value="validos">Válidos ({fmtN(p.validos)})</TabsTrigger>
            <TabsTrigger value="rechazados">Rechazados ({fmtN(p.rechazados)})</TabsTrigger>
            <TabsTrigger value="carga">Carga ({fmtN(p.aCargar.length)})</TabsTrigger>
            <TabsTrigger value="supabase">
              <DatabaseIcon aria-hidden /> Supabase
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="json">
          <PestanaJson ciudades={p.ciudadesEstado} alReintentar={p.reintentarCiudad} />
        </TabsContent>
        <TabsContent value="transformados">
          <PestanaTransformados registros={p.etl?.registros ?? []} avisos={p.etl?.avisos ?? []} />
        </TabsContent>
        <TabsContent value="validos">
          <PanelFiltros
            ciudadesDisponibles={p.ciudadesExtraidas}
            filtros={p.filtros}
            setFiltros={p.setFiltros}
            errores={p.errFiltros}
            orden={p.orden}
            setOrden={p.setOrden}
            ordenados={p.filtrado.ordenados}
            totalValidos={p.validos}
            seleccion={p.seleccion}
            setSeleccion={p.setSeleccion}
            fueraDeFiltros={p.fueraDeFiltros}
            aCargar={p.aCargar.length}
          />
        </TabsContent>
        <TabsContent value="rechazados">
          <PestanaRechazados
            rechazados={p.etl?.limpieza.rechazados ?? []}
            duplicados={p.etl?.limpieza.duplicadosEliminados ?? 0}
          />
        </TabsContent>
        <TabsContent value="carga">
          <PanelCarga
            filas={p.filasVistaPrevia}
            huellaVistaPrevia={p.huellaVistaPrevia}
            orden={p.orden}
            fueraDeFiltros={p.fueraDeFiltros}
            carga={p.carga}
            alSubir={p.subir}
            alReintentar={p.reintentarFallidos}
          />
        </TabsContent>
        <TabsContent value="supabase">
          <PestanaSupabase pendientesLocales={p.aCargar.length} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
