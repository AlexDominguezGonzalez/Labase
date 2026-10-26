import type { FilaCarga } from "./tipos"

export const TAM_LOTE = 500

export type EstadoLote = "pendiente" | "en_curso" | "completado" | "error"

export interface Lote {
  numero: number
  filas: FilaCarga[]
  estado: EstadoLote
  /** Filas que Supabase devolvió como escritas (upsert). */
  procesadas?: number
  error?: string
  duracionMs?: number
  intentos: number
}

export function crearLotes(filas: FilaCarga[], tam = TAM_LOTE): Lote[] {
  const lotes: Lote[] = []
  for (let i = 0; i < filas.length; i += tam) {
    lotes.push({
      numero: lotes.length + 1,
      // Copia congelada: cambios posteriores en la UI no afectan a la carga.
      filas: Object.freeze(
        filas.slice(i, i + tam).map((f) => ({ ...f }))
      ) as FilaCarga[],
      estado: "pendiente",
      intentos: 0,
    })
  }
  return lotes
}

export type EnviarLote = (filas: FilaCarga[]) => Promise<{ procesadas: number }>

/**
 * Envía en serie los lotes pendientes o con error. Un fallo no detiene los
 * siguientes lotes ni altera los ya completados; basta volver a llamar a esta
 * función para reintentar solo los que fallaron (el upsert es idempotente).
 */
export async function ejecutarLotes(
  lotes: Lote[],
  enviar: EnviarLote,
  alCambiar: (lotes: Lote[]) => void
): Promise<Lote[]> {
  let actual = lotes
  const actualizar = (i: number, cambios: Partial<Lote>) => {
    actual = actual.map((l, k) => (k === i ? { ...l, ...cambios } : l))
    alCambiar(actual)
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i].estado === "completado") continue
    const inicio = performance.now()
    actualizar(i, {
      estado: "en_curso",
      error: undefined,
      intentos: actual[i].intentos + 1,
    })
    try {
      const { procesadas } = await enviar(actual[i].filas)
      actualizar(i, {
        estado: "completado",
        procesadas,
        duracionMs: performance.now() - inicio,
      })
    } catch (e) {
      actualizar(i, {
        estado: "error",
        error: e instanceof Error ? e.message : String(e),
        duracionMs: performance.now() - inicio,
      })
    }
  }
  return actual
}

export function resumenLotes(lotes: Lote[]) {
  let correctas = 0
  let fallidas = 0
  let pendientes = 0
  for (const l of lotes) {
    if (l.estado === "completado") correctas += l.procesadas ?? 0
    else if (l.estado === "error") fallidas += l.filas.length
    else pendientes += l.filas.length
  }
  return { correctas, fallidas, pendientes }
}

/** Huella FNV-1a de un conjunto: permite comparar vista previa y envío. */
export function huella(datos: unknown): string {
  const texto = JSON.stringify(datos)
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}
