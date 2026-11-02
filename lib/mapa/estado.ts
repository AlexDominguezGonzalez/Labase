import { create } from "zustand"

import type { Pestana } from "@/hooks/use-pipeline-etl"

/**
 * Estado de la UI flotante. Vive fuera del árbol de React del mapa para que
 * un hover o la apertura de un panel no vuelvan a renderizar <Map>.
 *
 * - Izquierda: configuración de la extracción (independiente).
 * - Derecha: detalle de una ciudad O inspección de datos (excluyentes).
 */
export type PanelDerecho = "detalle" | "inspeccion" | null

interface EstadoMapa {
  seleccionada: string | null
  sobrevolada: string | null
  panel: PanelDerecho
  pestana: Pestana
  configAbierta: boolean
  seleccionar: (ciudad: string | null) => void
  sobrevolar: (ciudad: string | null) => void
  inspeccionar: (pestana: Pestana) => void
  cerrarPanel: () => void
  alternarConfig: (abierta?: boolean) => void
}

export const useEstadoMapa = create<EstadoMapa>((set) => ({
  seleccionada: null,
  sobrevolada: null,
  panel: null,
  pestana: "json",
  configAbierta: true,
  seleccionar: (ciudad) =>
    set({ seleccionada: ciudad, panel: ciudad ? "detalle" : null }),
  sobrevolar: (ciudad) => set({ sobrevolada: ciudad }),
  inspeccionar: (pestana) =>
    set({ panel: "inspeccion", pestana, seleccionada: null }),
  cerrarPanel: () => set({ panel: null, seleccionada: null }),
  alternarConfig: (abierta) =>
    set((s) => ({ configAbierta: abierta ?? !s.configAbierta })),
}))
