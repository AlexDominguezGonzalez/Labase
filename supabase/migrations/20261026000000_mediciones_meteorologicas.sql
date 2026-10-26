-- Práctica ETL: destino de las mediciones horarias de Open-Meteo.
-- Aplicar en Supabase: SQL Editor → pegar y ejecutar, o `supabase db push`.

create table if not exists public.mediciones_meteorologicas (
  id               bigint generated always as identity primary key,
  ciudad           text             not null,
  fecha_hora       timestamptz      not null,
  temperatura_c    double precision not null,
  humedad_pct      double precision not null,
  precipitacion_mm double precision not null,
  importado_en     timestamptz      not null default now(),

  constraint mediciones_ciudad_fecha_hora_key unique (ciudad, fecha_hora),
  constraint mediciones_ciudad_no_vacia check (length(btrim(ciudad)) > 0),
  constraint mediciones_humedad_rango check (humedad_pct >= 0 and humedad_pct <= 100),
  constraint mediciones_precipitacion_no_negativa check (precipitacion_mm >= 0),
  -- double precision admite NaN e Infinity; los excluimos explícitamente.
  constraint mediciones_valores_finitos check (
    temperatura_c  not in ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
    and humedad_pct not in ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
    and precipitacion_mm not in ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
  )
);

comment on table public.mediciones_meteorologicas is
  'Mediciones horarias (UTC) de Open-Meteo cargadas por el pipeline ETL de la práctica.';

-- Consultas habituales: por intervalo temporal.
create index if not exists mediciones_fecha_hora_idx
  on public.mediciones_meteorologicas (fecha_hora);

-- RLS activado y SIN políticas: anon y authenticated no pueden leer ni escribir.
-- Solo el servidor, con la service role key, accede a la tabla.
alter table public.mediciones_meteorologicas enable row level security;

revoke all on table public.mediciones_meteorologicas from anon, authenticated;
