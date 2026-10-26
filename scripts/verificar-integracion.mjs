// Verificación de integración contra la app en marcha (npm run dev) y Supabase real.
// Uso: npm run test:integracion   (BASE_URL opcional, por defecto http://localhost:3000)
// Sube datos REALES de Open-Meteo (Bilbao, 2026-09-02) y comprueba:
//   carga, verificación de claves, segunda carga sin duplicados y fallo parcial.

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
let fallos = 0
const ok = (cond, texto) => {
  console.log(`${cond ? "✔" : "✘"} ${texto}`)
  if (!cond) fallos++
}
const post = (ruta, cuerpo) =>
  fetch(BASE + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).then(async (r) => ({ estado: r.status, cuerpo: await r.json() }))

const estado = await fetch(`${BASE}/api/estado`).then((r) => r.json())
console.log("Estado del destino:", estado.mensaje)
if (!estado.listo) {
  console.log(
    "✘ Destino no preparado: integración PENDIENTE (aplica la migración)."
  )
  process.exit(2)
}

// Extracción real
const url =
  "https://archive-api.open-meteo.com/v1/archive?latitude=43.263&longitude=-2.935" +
  "&start_date=2026-09-02&end_date=2026-09-02&hourly=temperature_2m,relative_humidity_2m,precipitation" +
  "&timezone=UTC&temperature_unit=celsius&precipitation_unit=mm&timeformat=iso8601"
const json = await fetch(url).then((r) => r.json())
const h = json.hourly
const filas = h.time.map((t, i) => ({
  ciudad: "Bilbao",
  fecha_hora: new Date(`${t}:00Z`).toISOString(),
  temperatura_c: h.temperature_2m[i],
  humedad_pct: h.relative_humidity_2m[i],
  precipitacion_mm: h.precipitation[i],
}))
ok(
  filas.length === 24,
  `Open-Meteo real: ${filas.length} horas para Bilbao 2026-09-02`
)

const contar = async () => {
  const p = new URLSearchParams({
    ciudades: "Bilbao",
    desde: "2026-09-02T00:00:00Z",
    hasta: "2026-09-02T23:00:00Z",
    tam: "100",
  })
  return (await fetch(`${BASE}/api/datos?${p}`).then((r) => r.json())).total
}

const c1 = await post("/api/carga", { registros: filas })
ok(
  c1.estado === 200 && c1.cuerpo.procesadas === 24,
  `Primera carga: HTTP ${c1.estado}, procesadas=${c1.cuerpo.procesadas ?? c1.cuerpo.error}`
)
const total1 = await contar()
ok(total1 === 24, `Filas en destino tras 1.ª carga: ${total1}`)

const c2 = await post("/api/carga", { registros: filas })
const total2 = await contar()
ok(
  c2.estado === 200 && total2 === 24,
  `Segunda carga (upsert): procesadas=${c2.cuerpo.procesadas}, filas en destino=${total2} (sin duplicados)`
)

const v = await post("/api/verificar", {
  claves: filas.map(({ ciudad, fecha_hora }) => ({ ciudad, fecha_hora })),
})
ok(
  v.estado === 200 &&
    v.cuerpo.encontradas === 24 &&
    v.cuerpo.faltan.length === 0,
  `Verificación de claves: ${v.cuerpo.encontradas}/${v.cuerpo.comprobadas} encontradas`
)

// Fallo parcial: lote 1 válido, lote 2 inválido (lo rechaza el servidor).
const lote1 = filas.slice(0, 12)
const lote2 = filas
  .slice(12)
  .map((f, i) => (i === 0 ? { ...f, humedad_pct: 150 } : f))
const r1 = await post("/api/carga", { registros: lote1 })
const r2 = await post("/api/carga", { registros: lote2 })
ok(r1.estado === 200, `Fallo parcial · lote 1: HTTP ${r1.estado}`)
ok(
  r2.estado === 422,
  `Fallo parcial · lote 2 rechazado: HTTP ${r2.estado} — ${r2.cuerpo.error}`
)
ok((await contar()) === 24, "El lote fallido no altera los datos ya cargados")

// Seguridad básica
const grande = await fetch(`${BASE}/api/carga`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ registros: Array(501).fill(filas[0]) }),
})
ok(
  grande.status === 422 || grande.status === 413,
  `Lote de 501 filas rechazado: HTTP ${grande.status}`
)

const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sbUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
if (anon && sbUrl) {
  const r = await fetch(`${sbUrl}/rest/v1/mediciones_meteorologicas`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filas[0]),
  })
  ok(
    r.status >= 400,
    `Escritura con clave anónima bloqueada (RLS/permisos): HTTP ${r.status}`
  )
}

console.log(
  fallos === 0
    ? "\nIntegración: TODO CORRECTO"
    : `\nIntegración: ${fallos} fallo(s)`
)
process.exit(fallos === 0 ? 0 : 1)
