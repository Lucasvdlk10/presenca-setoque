-- Future cloud schema only: not deployed. Enable Supabase Auth + RLS before storing real CPF data.
create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null check (length(trim(name)) >= 2),
  cpf text not null,
  phone text,
  email text,
  birth_date date,
  notes text,
  photo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cpf)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  participant_id uuid not null references public.participants(id),
  attendance_date date not null,
  status text not null check (status in ('Presente','Falta','Falta Justificada','Feriado')),
  observation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, attendance_date),
  check (extract(isodow from attendance_date) in (1,3))
);

create index if not exists attendance_org_date_idx on public.attendance (organization_id, attendance_date);
create index if not exists attendance_participant_date_idx on public.attendance (participant_id, attendance_date);

-- Before use: add RLS policies for authenticated users and their organization_id.
-- Do not expose service-role keys in the React client.
