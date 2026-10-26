// Tipos compartidos por todas las fases del pipeline ETL.

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

export interface Ciudad {
  id: string
  nombre: string
  latitud: number
  longitud: number
}

/** Respuesta de Open-Meteo tal como llega (solo tipamos lo que usamos). */
export interface RespuestaOpenMeteo {
  latitude?: number
  longitude?: number
  utc_offset_seconds?: number
  timezone?: string
  hourly_units?: Record<string, string>
  hourly?: {
    time?: unknown[]
    temperature_2m?: unknown[]
    relative_humidity_2m?: unknown[]
    precipitation?: unknown[]
  }
  [clave: string]: unknown
}

export interface ExtraccionCiudad {
  ciudadId: string
  estado: "pendiente" | "en_curso" | "completada" | "error"
  url: string
  json?: RespuestaOpenMeteo
  error?: string
  duracionMs?: number
  intentos: number
}

/** Valor tal como venía en el array original: no se convierte nada todavía. */
export type ValorOriginal = unknown

/** Fila resultante de "desplegar" los arrays paralelos (fase Transformación). */
export interface RegistroTransformado {
  /** Identificador estable: ciudad + índice en la respuesta. */
  id: string
  ciudad: string
  indice: number
  fecha_hora_original: ValorOriginal
  /** ISO 8601 en UTC si la fecha es interpretable; null si no. */
  fecha_hora: string | null
  temperatura_original: ValorOriginal
  humedad_original: ValorOriginal
  precipitacion_original: ValorOriginal
  /** Avisos estructurales (p. ej. arrays de longitud distinta). */
  avisos: string[]
}

/** Registro normalizado y validado: es lo que se puede cargar. */
export interface RegistroValido {
  /** Clave natural "ciudad|fecha_hora ISO". */
  id: string
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export interface RegistroRechazado {
  registro: RegistroTransformado
  motivos: string[]
}

export interface ResultadoLimpieza {
  validos: RegistroValido[]
  rechazados: RegistroRechazado[]
  duplicadosEliminados: number
}

/** Formato que se envía a Supabase (sin id local). */
export interface FilaCarga {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}
