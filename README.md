# Pipeline ETL: Open-Meteo → Supabase

Primera práctica de la especialización en Big Data. La aplicación extrae
mediciones horarias reales de la API histórica de Open-Meteo, las transforma,
limpia y filtra, y carga en Supabase **solo** los registros que el usuario
selecciona. Cada fase muestra su estado, sus registros de entrada y salida y su
duración real.

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui (base-ui),
`@supabase/supabase-js`, `zod`, `vitest`.

## Puesta en marcha

1. `npm install`
2. Copia `.env.example` como `.env.local` y rellena:
   - `SUPABASE_URL`: URL del proyecto (también se acepta `NEXT_PUBLIC_SUPABASE_URL`).
   - `SUPABASE_SERVICE_ROLE_KEY`: clave secreta. **Nunca** con prefijo `NEXT_PUBLIC_`.
3. Crea la tabla: abre Supabase → SQL Editor y ejecuta
   [`supabase/migrations/20261026000000_mediciones_meteorologicas.sql`](supabase/migrations/20261026000000_mediciones_meteorologicas.sql)
   (o `supabase db push` si usas la CLI).
4. `npm run dev` y abre http://localhost:3000

## Flujo de datos

```
Extracción → Transformación → Limpieza → Filtrado y selección → Carga
```

| Fase | Qué hace | Dónde |
| --- | --- | --- |
| Extracción | Una petición por ciudad (UTC, °C, mm, máx. 31 días). El JSON original se conserva en la sesión y se puede descargar. Si una ciudad falla, se reintenta solo esa ciudad (su JSON se **sustituye**, no se acumula). | `lib/etl/extraccion.ts` |
| Transformación | Los arrays paralelos de `hourly` se convierten en una fila por ciudad y hora. Se comprueban las longitudes; las fechas se interpretan como UTC con `Date.UTC`. No se convierte ningún valor. | `lib/etl/transformacion.ts` |
| Limpieza | Rechaza filas sin ciudad, sin fecha válida o con alguna medición nula, vacía, ausente, no numérica o no finita; humedad fuera de 0–100; precipitación negativa. **Sin** umbrales de temperatura. Cada rechazo guarda su motivo. | `lib/etl/limpieza.ts` |
| Filtrado y selección | válidos → filtros → ordenación → selección. La paginación solo afecta a la vista. | `lib/etl/filtrado.ts` |
| Carga | Copia congelada del conjunto, lotes de ≤ 500, upsert por `(ciudad, fecha_hora)`, estado por lote, reintento de lotes fallidos y verificación posterior de las claves en destino. | `lib/etl/carga.ts`, `app/api/*` |

**Duplicados:** se identifican por `(ciudad, fecha_hora)` y se conserva la
**primera aparición válida** en orden de llegada (orden de ciudades y, dentro de
cada una, índice del array). Las siguientes aparecen en «Rechazados» con el
motivo «Duplicado…». Los registros excluidos por filtros **no** son rechazos:
siguen siendo válidos.

**Selección:** solo se suben las filas seleccionadas que cumplen los filtros
actuales. Si hay filas seleccionadas fuera de los filtros, se indica cuántas.
Cambiar filtros nunca añade filas a la selección.

**Recuentos:** PostgREST devuelve las filas escritas por el upsert sin distinguir
insertadas de actualizadas, así que la app informa solo de «procesadas».

**Orden:** una tabla no conserva el orden de inserción; para leer ordenado hay
que usar `ORDER BY` (la pestaña «Datos en Supabase» siempre lo fija).

## Seguridad

- Toda la escritura y lectura de Supabase ocurre en Route Handlers
  (`app/api/carga`, `verificar`, `datos`, `estado`) con `import "server-only"`.
  La clave de servicio no llega nunca al navegador ni se escribe en logs.
- El servidor vuelve a validar cada fila con `zod` (ciudad conocida, ISO UTC,
  números finitos, rangos, sin campos extra), limita cada lote a 500 filas y el
  cuerpo a 256 KB.
- La tabla tiene RLS activado y **ninguna** política; además se revocan los
  permisos de `anon` y `authenticated`.
- **El proyecto no tiene autenticación.** Los endpoints quedan abiertos solo en
  desarrollo: con `NODE_ENV=production` responden 403, salvo que se defina
  `ETL_PERMITIR_EN_PRODUCCION=true`, lo que solo debe hacerse tras añadir
  protección (login, red privada…). **Antes de publicar, protege los endpoints.**

## Pruebas

```bash
npm test                 # unitarias con fixtures + 1 prueba real contra Open-Meteo
npm run typecheck
npm run lint
npm run build
npm run test:integracion # con `npm run dev` en marcha y la tabla creada
```

Los fixtures controlados (nulos, cadenas vacías, tipos erróneos, rangos
inválidos, duplicados, longitudes incoherentes) están en `tests/fixtures/` y
**solo** se usan en los tests; nunca se mezclan con las extracciones reales de
la interfaz.

`scripts/verificar-integracion.mjs` usa datos reales (Bilbao, 2026-09-02) y
comprueba: carga, verificación de claves, segunda carga sin duplicados, fallo
parcial de un lote sin alterar los anteriores, rechazo de lotes de 501 filas y
que la clave anónima no puede escribir.
