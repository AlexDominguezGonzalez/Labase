import { ciudadPorId } from "./ciudades"
import { aplicarFiltros, ordenar, type Filtros, type Orden } from "./filtrado"
import { limpiar } from "./limpieza"
import type { ExtraccionCiudad, RegistroTransformado } from "./tipos"
import { transformarRespuesta } from "./transformacion"

/**
 * Ejecuta Transformación y Limpieza sobre las ciudades descargadas y mide su
 * duración real. La duración es solo informativa: el resultado de los datos
 * es determinista para una misma entrada.
 */
export function transformarYLimpiar(ciudades: ExtraccionCiudad[]) {
  const completadas = ciudades.filter(
    (c) => c.estado === "completada" && c.json
  )
  const filasRecibidas = completadas.reduce(
    (n, c) =>
      n +
      (Array.isArray(c.json!.hourly?.time) ? c.json!.hourly!.time!.length : 0),
    0
  )
  const t0 = performance.now()
  const registros: RegistroTransformado[] = []
  const avisos: { ciudad: string; avisos: string[] }[] = []
  for (const c of completadas) {
    const nombre = ciudadPorId(c.ciudadId)?.nombre ?? c.ciudadId
    const r = transformarRespuesta(nombre, c.json!)
    registros.push(...r.registros)
    if (r.avisos.length) avisos.push({ ciudad: nombre, avisos: r.avisos })
  }
  const t1 = performance.now()
  const limpieza = limpiar(registros)
  const t2 = performance.now()
  return {
    respuestas: completadas.length,
    filasRecibidas,
    registros,
    avisos,
    limpieza,
    duracionTransformacion: t1 - t0,
    duracionLimpieza: t2 - t1,
  }
}

/** Filtros y después ordenación, siempre sobre el conjunto completo. */
export function filtrarYOrdenar(
  validos: Parameters<typeof aplicarFiltros>[0],
  filtros: Filtros,
  orden: Orden
) {
  const t0 = performance.now()
  const ordenados = ordenar(aplicarFiltros(validos, filtros), orden)
  return { ordenados, duracionMs: performance.now() - t0 }
}
