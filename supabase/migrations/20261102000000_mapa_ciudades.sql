-- Vista Map-First: geometría de las ciudades, consulta por bounding box y
-- difusión en tiempo real de la última medición de cada ciudad.
-- Aplicar después de 20261026000000_mediciones_meteorologicas.sql.

create extension if not exists postgis with schema extensions;

-- ---------- Ciudades con geometría ----------
create table if not exists public.ciudades (
  nombre    text primary key,
  ubicacion extensions.geometry(Point, 4326) not null
);

comment on table public.ciudades is
  'Ubicación de cada ciudad del pipeline. Permite filtrar por bounding box con índice espacial.';

insert into public.ciudades (nombre, ubicacion) values
  ('Barcelona', extensions.st_setsrid(extensions.st_makepoint(2.1686, 41.3874), 4326)),
  ('Madrid',    extensions.st_setsrid(extensions.st_makepoint(-3.7038, 40.4168), 4326)),
  ('Sevilla',   extensions.st_setsrid(extensions.st_makepoint(-5.9845, 37.3891), 4326)),
  ('Bilbao',    extensions.st_setsrid(extensions.st_makepoint(-2.935, 43.263), 4326)),
  ('Valencia',  extensions.st_setsrid(extensions.st_makepoint(-0.3763, 39.4699), 4326))
on conflict (nombre) do update set ubicacion = excluded.ubicacion;

create index if not exists ciudades_ubicacion_gix
  on public.ciudades using gist (ubicacion);

-- Igual que la tabla de mediciones: RLS sin políticas, solo el servidor accede.
alter table public.ciudades enable row level security;
revoke all on table public.ciudades from anon, authenticated;

-- "Última medición de cada ciudad" = un index scan hacia atrás por ciudad.
create index if not exists mediciones_ciudad_fecha_hora_desc_idx
  on public.mediciones_meteorologicas (ciudad, fecha_hora desc);

-- ---------- Consulta por bounding box ----------
-- Devuelve una fila por ciudad dentro del recuadro, con su última medición
-- (opcionalmente hasta un instante dado). Las ciudades sin datos salen con
-- mediciones a null para que el mapa pueda pintarlas igualmente.
create or replace function public.ultimas_mediciones_en_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  hasta   timestamptz default null,
  limite  integer     default 500
)
returns table (
  ciudad           text,
  longitud         double precision,
  latitud          double precision,
  fecha_hora       timestamptz,
  temperatura_c    double precision,
  humedad_pct      double precision,
  precipitacion_mm double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.nombre,
    extensions.st_x(c.ubicacion),
    extensions.st_y(c.ubicacion),
    m.fecha_hora,
    m.temperatura_c,
    m.humedad_pct,
    m.precipitacion_mm
  from public.ciudades c
  left join lateral (
    select mm.fecha_hora, mm.temperatura_c, mm.humedad_pct, mm.precipitacion_mm
    from public.mediciones_meteorologicas mm
    where mm.ciudad = c.nombre
      and (hasta is null or mm.fecha_hora <= hasta)
    order by mm.fecha_hora desc
    limit 1
  ) m on true
  -- && usa el índice GIST: compara recuadros, no geometrías exactas.
  where c.ubicacion operator(extensions.&&)
        extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by c.nombre
  limit least(greatest(limite, 1), 2000);
$$;

revoke all on function public.ultimas_mediciones_en_bbox from public, anon, authenticated;
grant execute on function public.ultimas_mediciones_en_bbox to service_role;

-- ---------- Tiempo real (Broadcast) ----------
-- No abrimos la tabla a anon: en lugar de postgres_changes, un trigger por
-- SENTENCIA difunde solo la última medición de cada ciudad afectada. Un lote
-- de 500 filas genera como mucho un mensaje por ciudad, no 500.
-- El canal es público: cualquiera con la clave publicable puede escucharlo,
-- y solo contiene los mismos datos que ya muestra el mapa.
create or replace function public.difundir_ultimas_mediciones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fila record;
begin
  for fila in
    select distinct on (n.ciudad)
      n.ciudad, n.fecha_hora, n.temperatura_c, n.humedad_pct, n.precipitacion_mm
    from nuevas n
    order by n.ciudad, n.fecha_hora desc
  loop
    perform realtime.send(
      jsonb_build_object(
        'ciudad', fila.ciudad,
        'fecha_hora', fila.fecha_hora,
        'temperatura_c', fila.temperatura_c,
        'humedad_pct', fila.humedad_pct,
        'precipitacion_mm', fila.precipitacion_mm
      ),
      'medicion',          -- evento
      'mapa:mediciones',   -- topic
      false                -- canal público
    );
  end loop;
  return null;
end;
$$;

revoke all on function public.difundir_ultimas_mediciones from public, anon, authenticated;

-- Las tablas de transición no admiten varios eventos en un mismo trigger:
-- uno para INSERT y otro para UPDATE (el upsert dispara ambos).
drop trigger if exists mediciones_difundir_insert on public.mediciones_meteorologicas;
create trigger mediciones_difundir_insert
  after insert on public.mediciones_meteorologicas
  referencing new table as nuevas
  for each statement execute function public.difundir_ultimas_mediciones();

drop trigger if exists mediciones_difundir_update on public.mediciones_meteorologicas;
create trigger mediciones_difundir_update
  after update on public.mediciones_meteorologicas
  referencing new table as nuevas
  for each statement execute function public.difundir_ultimas_mediciones();
