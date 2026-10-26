// FIXTURES CONTROLADOS: solo se usan en los tests, nunca en la interfaz.
import type { RespuestaOpenMeteo } from "@/lib/etl/tipos"

/** Horas con nulos, cadena vacía, tipos erróneos, rangos inválidos y una hora repetida. */
export const conProblemas: RespuestaOpenMeteo = {
  utc_offset_seconds: 0,
  hourly: {
    time: [
      "2026-09-01T00:00",
      "2026-09-01T01:00",
      "2026-09-01T02:00",
      "2026-09-01T03:00",
      "2026-09-01T01:00", // misma hora que la fila 1
      "no-es-fecha",
      "2026-09-01T06:00",
      "2026-09-01T07:00",
    ],
    temperature_2m: [20.5, null, 19.0, -45.3, 99.9, 18, 17, ""],
    relative_humidity_2m: [60, 61, 120, 70, 50, 55, 0, 80],
    precipitation: [0, 0.2, 0, -0.1, 0.3, 0, 0, "1.0"],
  },
}

/** Arrays de longitud incoherente. */
export const longitudesIncoherentes: RespuestaOpenMeteo = {
  utc_offset_seconds: 0,
  hourly: {
    time: ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T02:00"],
    temperature_2m: [10, 11, 12],
    relative_humidity_2m: [50, 51],
    precipitation: [0, 0, 0],
  },
}

/** Genera una respuesta sintética limpia de n horas desde una fecha. */
export function sintetica(
  n: number,
  desde = "2026-09-01T00:00:00Z"
): RespuestaOpenMeteo {
  const t0 = Date.parse(desde)
  const time: string[] = []
  const temp: number[] = []
  const hum: number[] = []
  const prec: number[] = []
  for (let i = 0; i < n; i++) {
    time.push(new Date(t0 + i * 3_600_000).toISOString().slice(0, 16))
    temp.push(15 + (i % 17))
    hum.push(40 + (i % 50))
    prec.push(i % 5 === 0 ? 0.4 : 0)
  }
  return {
    utc_offset_seconds: 0,
    hourly: {
      time,
      temperature_2m: temp,
      relative_humidity_2m: hum,
      precipitation: prec,
    },
  }
}
