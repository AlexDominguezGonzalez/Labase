// Prueba contra la API REAL de Open-Meteo (requiere red). No usa fixtures.
import { describe, expect, it } from "vitest"

import { ciudadPorId } from "@/lib/etl/ciudades"
import { construirUrl, descargarCiudad } from "@/lib/etl/extraccion"
import { limpiar } from "@/lib/etl/limpieza"
import { transformarRespuesta } from "@/lib/etl/transformacion"

describe("Open-Meteo real", () => {
  it("una ciudad durante un día devuelve 24 registros horarios en UTC", async () => {
    const url = construirUrl(
      ciudadPorId("barcelona")!,
      "2026-09-01",
      "2026-09-01"
    )
    const json = await descargarCiudad(url)
    expect(json.utc_offset_seconds).toBe(0)
    const t = transformarRespuesta("Barcelona", json)
    expect(t.avisos).toEqual([])
    expect(t.registros).toHaveLength(24)
    expect(t.registros[0].fecha_hora).toBe("2026-09-01T00:00:00.000Z")
    expect(t.registros[23].fecha_hora).toBe("2026-09-01T23:00:00.000Z")
    const l = limpiar(t.registros)
    console.log(
      `Barcelona 2026-09-01: ${l.validos.length} válidos, ${l.rechazados.length} rechazados`
    )
  }, 20_000)
})
