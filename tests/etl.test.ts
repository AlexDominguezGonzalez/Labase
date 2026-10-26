import { describe, expect, it } from "vitest"

import {
  crearLotes,
  ejecutarLotes,
  huella,
  resumenLotes,
  TAM_LOTE,
} from "@/lib/etl/carga"
import { CIUDADES } from "@/lib/etl/ciudades"
import { construirUrl, validarConfiguracion } from "@/lib/etl/extraccion"
import {
  aFilaCarga,
  aplicarFiltros,
  conjuntoDeCarga,
  filtrosIniciales,
  ordenar,
  paginar,
  seleccionFueraDeFiltros,
} from "@/lib/etl/filtrado"
import { limpiar, MOTIVO_DUPLICADO } from "@/lib/etl/limpieza"
import {
  interpretarFechaUtc,
  transformarRespuesta,
} from "@/lib/etl/transformacion"
import type { FilaCarga } from "@/lib/etl/tipos"
import { esquemaCarga } from "@/lib/servidor/validacion"

import {
  conProblemas,
  longitudesIncoherentes,
  sintetica,
} from "./fixtures/respuestas"

describe("extracción", () => {
  it("construye la URL en UTC, °C y mm", () => {
    const u = new URL(construirUrl(CIUDADES[0], "2026-09-01", "2026-09-01"))
    expect(u.origin + u.pathname).toBe(
      "https://archive-api.open-meteo.com/v1/archive"
    )
    expect(u.searchParams.get("timezone")).toBe("UTC")
    expect(u.searchParams.get("temperature_unit")).toBe("celsius")
    expect(u.searchParams.get("precipitation_unit")).toBe("mm")
    expect(u.searchParams.get("hourly")).toBe(
      "temperature_2m,relative_humidity_2m,precipitation"
    )
  })

  it("limita a 31 días y valida fechas", () => {
    const hoy = new Date("2026-10-26T12:00:00Z")
    const v = (c: string[], a: string, b: string) =>
      validarConfiguracion(c, a, b, hoy)
    expect(v(["madrid"], "2026-09-01", "2026-09-30").errores).toEqual([])
    expect(v(["madrid"], "2026-08-01", "2026-09-01").errores[0]).toMatch(
      /32 días/
    )
    expect(v(["madrid"], "2026-09-10", "2026-09-01").errores).toHaveLength(1)
    expect(v([], "2026-09-01", "2026-09-01").errores).toHaveLength(1)
    expect(v(["madrid"], "2026-02-30", "2026-03-01").errores).toHaveLength(1)
    expect(v(["madrid"], "2026-10-20", "2026-10-26").errores).toHaveLength(1)
    expect(v(["a", "b"], "2026-09-01", "2026-09-30").registrosPrevistos).toBe(
      1440
    )
  })
})

describe("transformación", () => {
  it("convierte arrays paralelos en filas e interpreta UTC explícitamente", () => {
    const { registros, avisos } = transformarRespuesta("Madrid", sintetica(24))
    expect(avisos).toEqual([])
    expect(registros).toHaveLength(24)
    expect(registros[0].fecha_hora).toBe("2026-09-01T00:00:00.000Z")
    expect(registros[23].fecha_hora).toBe("2026-09-01T23:00:00.000Z")
    expect(registros[5].temperatura_original).toBe(20)
    expect(registros[5].humedad_original).toBe(45)
    expect(interpretarFechaUtc("2026-09-31T00:00")).toBeNull()
    expect(interpretarFechaUtc("2026-09-01T00:00+02:00")).toBeNull()
    expect(interpretarFechaUtc("2026-09-01T00:00Z")).toBe(
      "2026-09-01T00:00:00.000Z"
    )
  })

  it("detecta longitudes incoherentes y rechaza las filas incompletas", () => {
    const t = transformarRespuesta("Bilbao", longitudesIncoherentes)
    expect(t.avisos[0]).toMatch(/longitud incoherente/)
    const l = limpiar(t.registros)
    expect(l.validos).toHaveLength(2)
    expect(l.rechazados[0].motivos.join()).toMatch(/relative_humidity_2m/)
  })
})

describe("limpieza (fixture con nulos y duplicados)", () => {
  const t = transformarRespuesta("Sevilla", conProblemas)
  const l = limpiar(t.registros)
  const motivos = (i: number) =>
    l.rechazados.find((r) => r.registro.indice === i)?.motivos.join(" | ") ?? ""

  it("no convierte null ni cadena vacía en cero", () => {
    expect(t.registros[1].temperatura_original).toBeNull()
    expect(motivos(1)).toMatch(/Temperatura: valor nulo/)
    expect(motivos(7)).toMatch(/Temperatura: cadena vacía/)
    expect(motivos(7)).toMatch(/Precipitación: tipo string/)
    expect(l.validos.some((v) => v.temperatura_c === 0)).toBe(false)
  })

  it("valida rangos de humedad y precipitación sin umbrales de temperatura", () => {
    expect(motivos(2)).toMatch(/Humedad fuera de 0–100/)
    expect(motivos(3)).toMatch(/Precipitación negativa/)
    expect(motivos(3)).not.toMatch(/Temperatura/) // -45,3 °C no se rechaza
    const h6 = l.validos.find((v) => v.fecha_hora.startsWith("2026-09-01T06"))
    expect(h6?.humedad_pct).toBe(0) // 0 % es un valor válido
  })

  it("rechaza fechas no válidas", () => {
    expect(motivos(5)).toMatch(/fecha_hora no válida/)
  })

  it("detecta duplicados y conserva la primera aparición válida", () => {
    // La fila 1 (01:00) es inválida, así que para 01:00 se conserva la fila 4.
    const h1 = l.validos.find((v) => v.fecha_hora.startsWith("2026-09-01T01"))
    expect(h1?.temperatura_c).toBe(99.9)
    expect(l.duplicadosEliminados).toBe(0)

    // Duplicado real: la misma respuesta dos veces.
    const a = transformarRespuesta("Sevilla", sintetica(3)).registros
    const b = transformarRespuesta("Sevilla", {
      ...sintetica(3),
      hourly: { ...sintetica(3).hourly, temperature_2m: [1, 2, 3] },
    }).registros.map((r) => ({ ...r, id: r.id + "-b" }))
    const dup = limpiar([...a, ...b])
    expect(dup.validos).toHaveLength(3)
    expect(dup.validos.map((v) => v.temperatura_c)).toEqual([15, 16, 17])
    expect(dup.duplicadosEliminados).toBe(3)
    expect(dup.rechazados[0].motivos[0]).toContain(MOTIVO_DUPLICADO)
  })
})

describe("filtros, orden, selección y carga", () => {
  const validos = limpiar([
    ...transformarRespuesta("Madrid", sintetica(72)).registros,
    ...transformarRespuesta("Bilbao", sintetica(72)).registros,
  ]).validos
  const base = filtrosIniciales(["Madrid", "Bilbao"])
  const porFecha = { campo: "fecha_hora", direccion: "asc" } as const

  it("filtra y ordena antes de paginar", () => {
    const f = aplicarFiltros(validos, { ...base, tempMin: "28" })
    const o = ordenar(f, { campo: "temperatura_c", direccion: "desc" })
    expect(o.every((r) => r.temperatura_c >= 28)).toBe(true)
    // La primera fila de la página 1 es el máximo de TODO el conjunto.
    expect(paginar(o, 0, 25)[0].temperatura_c).toBe(
      Math.max(...validos.map((v) => v.temperatura_c))
    )
    const lluvia = aplicarFiltros(validos, { ...base, soloLluvia: true })
    expect(lluvia.length).toBeGreaterThan(0)
    expect(lluvia.every((r) => r.precipitacion_mm > 0)).toBe(true)
    const rango = aplicarFiltros(validos, {
      ...base,
      desde: "2026-09-02T00:00",
      hasta: "2026-09-02T05:00",
    })
    expect(rango).toHaveLength(12) // 6 horas × 2 ciudades
    const asc = ordenar(validos, { campo: "ciudad", direccion: "asc" })
    expect(asc[0].ciudad).toBe("Bilbao")
  })

  it("selecciona entre páginas y solo carga lo seleccionado que cumple filtros", () => {
    const o = ordenar(aplicarFiltros(validos, base), porFecha)
    const sel = new Set([
      paginar(o, 0, 25)[0].id,
      paginar(o, 3, 25)[2].id,
      paginar(o, 5, 25)[1].id,
    ])
    expect(conjuntoDeCarga(o, sel)).toHaveLength(3)
    const soloMadrid = ordenar(
      aplicarFiltros(validos, { ...base, ciudades: ["Madrid"] }),
      porFecha
    )
    const carga = conjuntoDeCarga(soloMadrid, sel)
    expect(carga.every((r) => r.ciudad === "Madrid")).toBe(true)
    expect(seleccionFueraDeFiltros(soloMadrid, sel)).toBe(3 - carga.length)
    // Cambiar filtros no añade registros a la selección.
    expect(sel.size).toBe(3)
  })

  it("los lotes enviados coinciden exactamente con la vista previa", async () => {
    const o = ordenar(aplicarFiltros(validos, base), {
      campo: "humedad_pct",
      direccion: "desc",
    })
    const unaVez = conjuntoDeCarga(o, new Set(o.map((r) => r.id))).map(
      aFilaCarga
    )
    const vistaPrevia = ["Madrid", "Valencia", "Sevilla", "Barcelona"].flatMap(
      (c) => unaVez.map((f) => ({ ...f, ciudad: c }))
    )
    const lotes = crearLotes(vistaPrevia)
    expect(lotes.map((l) => l.filas.length)).toEqual([500, 76])
    const enviados: FilaCarga[] = []
    await ejecutarLotes(
      lotes,
      async (filas) => {
        enviados.push(...filas)
        return { procesadas: filas.length }
      },
      () => {}
    )
    expect(enviados).toEqual(vistaPrevia)
    expect(huella(enviados)).toBe(huella(vistaPrevia))
    expect(esquemaCarga.safeParse({ registros: lotes[0].filas }).success).toBe(
      true
    )
  })

  it("la copia congelada no cambia si cambia el conjunto original", () => {
    const filas = validos.slice(0, 3).map(aFilaCarga)
    const lotes = crearLotes(filas)
    filas[0].temperatura_c = 999
    filas.pop()
    expect(lotes[0].filas).toHaveLength(3)
    expect(lotes[0].filas[0].temperatura_c).not.toBe(999)
  })

  it("fallo parcial: conserva lotes completados y reintenta solo los fallidos", async () => {
    const filas: FilaCarga[] = Array.from({ length: 1200 }, (_, i) => ({
      ciudad: "Madrid",
      fecha_hora: new Date(Date.UTC(2026, 8, 1) + i * 3_600_000).toISOString(),
      temperatura_c: 20,
      humedad_pct: 50,
      precipitacion_mm: 0,
    }))
    const llamadas: number[] = []
    let fallar = true
    const enviar = async (lote: FilaCarga[]) => {
      llamadas.push(lote.length)
      if (fallar && lote[0].fecha_hora === filas[TAM_LOTE].fecha_hora) {
        throw new Error("HTTP 502 simulado")
      }
      return { procesadas: lote.length }
    }
    let lotes = await ejecutarLotes(crearLotes(filas), enviar, () => {})
    expect(lotes.map((l) => l.estado)).toEqual([
      "completado",
      "error",
      "completado",
    ])
    expect(lotes[1].error).toBe("HTTP 502 simulado")
    expect(resumenLotes(lotes)).toEqual({
      correctas: 700,
      fallidas: 500,
      pendientes: 0,
    })
    fallar = false
    lotes = await ejecutarLotes(lotes, enviar, () => {})
    expect(llamadas).toEqual([500, 500, 200, 500]) // solo se reenvía el lote 2
    expect(lotes[1].intentos).toBe(2)
    expect(lotes[0].intentos).toBe(1)
    expect(resumenLotes(lotes)).toEqual({
      correctas: 1200,
      fallidas: 0,
      pendientes: 0,
    })
  })
})

describe("validación en servidor", () => {
  const ok = {
    ciudad: "Madrid",
    fecha_hora: "2026-09-01T00:00:00.000Z",
    temperatura_c: 1,
    humedad_pct: 50,
    precipitacion_mm: 0,
  }
  const valida = (r: unknown[]) =>
    esquemaCarga.safeParse({ registros: r }).success

  it("rechaza filas inválidas, campos extra y lotes demasiado grandes", () => {
    expect(valida([ok])).toBe(true)
    expect(valida([{ ...ok, humedad_pct: 101 }])).toBe(false)
    expect(valida([{ ...ok, precipitacion_mm: -1 }])).toBe(false)
    expect(valida([{ ...ok, temperatura_c: null }])).toBe(false)
    expect(valida([{ ...ok, ciudad: "Atlantis" }])).toBe(false)
    expect(valida([{ ...ok, id: 3 }])).toBe(false)
    expect(valida([{ ...ok, fecha_hora: "2026-09-01T00:00:00+02:00" }])).toBe(
      false
    )
    expect(valida(Array(501).fill(ok))).toBe(false)
    expect(valida([])).toBe(false)
  })
})
