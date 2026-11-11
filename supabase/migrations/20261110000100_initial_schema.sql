-- Initial cloud schema for Sistema de Presença — Grupo Se Toque.
-- The normalized tables are the write model; analytics exposes a read-only star layer.

BEGIN;

CREATE SCHEMA private;
CREATE SCHEMA analytics;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA analytics TO authenticated;

CREATE TYPE public.attendance_status AS ENUM (
  'Presente', 'Falta', 'Falta Justificada', 'Feriado'
);

CREATE TABLE private.app_user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = 'admin'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.app_user_roles FROM PUBLIC, anon, authenticated, service_role;


CREATE TABLE public.app_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(trim(name)) >= 2),
  active boolean NOT NULL DEFAULT true,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  birth_date date,
  notes text NOT NULL DEFAULT '',
  photo_path text,
  photo_mime_type text CHECK (photo_mime_type IS NULL OR photo_mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cpf ~ '^[0-9.-]+$' AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11),
  CHECK ((photo_path IS NULL) = (photo_mime_type IS NULL)),
  CHECK (photo_path IS NULL OR photo_path LIKE id::text || '/%')
);
CREATE INDEX participants_active_name_idx
  ON public.participants (active, lower(name));

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL UNIQUE,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (extract(isodow FROM meeting_date) IN (1, 3))
);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  status public.attendance_status NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, participant_id)
);
CREATE INDEX attendance_meeting_idx ON public.attendance (meeting_id);
CREATE INDEX attendance_participant_idx ON public.attendance (participant_id);

CREATE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.app_user_roles AS r
    WHERE r.user_id = auth.uid()
      AND r.role = 'admin'
      AND r.active
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;

-- One-time, privileged bootstrap. It cannot be called by anon/authenticated users.
CREATE FUNCTION private.bootstrap_first_admin(p_user_id uuid, p_display_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
BEGIN
  IF p_user_id IS NULL OR char_length(trim(coalesce(p_display_name, ''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Invalid initial administrator details' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM private.app_user_roles) THEN
    RAISE EXCEPTION 'Initial administrator is already configured' USING ERRCODE = '55000';
  END IF;
  INSERT INTO private.app_user_roles (user_id, role, active)
  VALUES (p_user_id, 'admin', true);
  INSERT INTO public.app_profiles (user_id, display_name)
  VALUES (p_user_id, trim(p_display_name));
END;
$$;
REVOKE ALL ON FUNCTION private.bootstrap_first_admin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.bootstrap_first_admin(uuid, text) TO service_role;

ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_profiles_read_admin ON public.app_profiles;
CREATE POLICY app_profiles_read_admin ON public.app_profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.is_active_admin());
DROP POLICY IF EXISTS app_profiles_update_admin ON public.app_profiles;
CREATE POLICY app_profiles_update_admin ON public.app_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.is_active_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_active_admin());

DROP POLICY IF EXISTS participants_admin_select ON public.participants;
CREATE POLICY participants_admin_select ON public.participants
  FOR SELECT TO authenticated USING (public.is_active_admin());
DROP POLICY IF EXISTS participants_admin_insert ON public.participants;
CREATE POLICY participants_admin_insert ON public.participants
  FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
DROP POLICY IF EXISTS participants_admin_update ON public.participants;
CREATE POLICY participants_admin_update ON public.participants
  FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS meetings_admin_select ON public.meetings;
CREATE POLICY meetings_admin_select ON public.meetings
  FOR SELECT TO authenticated USING (public.is_active_admin());
DROP POLICY IF EXISTS meetings_admin_insert ON public.meetings;
CREATE POLICY meetings_admin_insert ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS attendance_admin_select ON public.attendance;
CREATE POLICY attendance_admin_select ON public.attendance
  FOR SELECT TO authenticated USING (public.is_active_admin());
DROP POLICY IF EXISTS attendance_admin_insert ON public.attendance;
CREATE POLICY attendance_admin_insert ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
DROP POLICY IF EXISTS attendance_admin_update ON public.attendance;
CREATE POLICY attendance_admin_update ON public.attendance
  FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
DROP POLICY IF EXISTS attendance_admin_delete ON public.attendance;
CREATE POLICY attendance_admin_delete ON public.attendance
  FOR DELETE TO authenticated USING (public.is_active_admin());

REVOKE ALL ON public.app_profiles, public.participants, public.meetings, public.attendance FROM PUBLIC, anon;
GRANT SELECT ON public.app_profiles TO authenticated;
GRANT UPDATE (display_name) ON public.app_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.participants TO authenticated;
GRANT SELECT, INSERT ON public.meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;

CREATE FUNCTION public.save_attendance_batch(p_meeting_date date, p_records jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row record;
  v_participant_id uuid;
  v_meeting_id uuid;
  v_status public.attendance_status;
  v_saved integer := 0;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_meeting_date IS NULL OR extract(isodow FROM p_meeting_date) NOT IN (1, 3) THEN
    RAISE EXCEPTION 'Meeting date must be Monday or Wednesday' USING ERRCODE = '22023';
  END IF;
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'Invalid attendance batch' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_records) > 500 THEN
    RAISE EXCEPTION 'Attendance batch is too large' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_records) AS x(cpf text, status text, observacao text)
    GROUP BY x.cpf HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate participant in attendance batch' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.meetings (meeting_date)
  VALUES (p_meeting_date)
  ON CONFLICT (meeting_date) DO NOTHING;
  SELECT m.id INTO STRICT v_meeting_id
  FROM public.meetings AS m
  WHERE m.meeting_date = p_meeting_date;

  FOR v_row IN
    SELECT * FROM jsonb_to_recordset(p_records) AS x(cpf text, status text, observacao text)
  LOOP
    SELECT p.id INTO v_participant_id
    FROM public.participants AS p
    WHERE p.cpf = trim(coalesce(v_row.cpf, ''));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Participant not found in attendance batch' USING ERRCODE = '22023';
    END IF;

    IF trim(coalesce(v_row.status, '')) = '' THEN
      DELETE FROM public.attendance AS a
      WHERE a.meeting_id = v_meeting_id AND a.participant_id = v_participant_id;
    ELSE
      BEGIN
        v_status := trim(v_row.status)::public.attendance_status;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid attendance status' USING ERRCODE = '22023';
      END;
      INSERT INTO public.attendance (meeting_id, participant_id, status, notes)
      VALUES (v_meeting_id, v_participant_id, v_status, coalesce(v_row.observacao, ''))
      ON CONFLICT (meeting_id, participant_id) DO UPDATE
        SET status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            updated_at = now();
      v_saved := v_saved + 1;
    END IF;
  END LOOP;

  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.save_attendance_batch(date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_attendance_batch(date, jsonb) TO authenticated;

-- Photos stay in a private bucket; only active administrators can access objects.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('participant-photos', 'participant-photos', false, 6291456,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]);

DROP POLICY IF EXISTS participant_photos_admin_select ON storage.objects;
CREATE POLICY participant_photos_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'participant-photos' AND public.is_active_admin());
DROP POLICY IF EXISTS participant_photos_admin_insert ON storage.objects;
CREATE POLICY participant_photos_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'participant-photos' AND public.is_active_admin());
DROP POLICY IF EXISTS participant_photos_admin_update ON storage.objects;
CREATE POLICY participant_photos_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'participant-photos' AND public.is_active_admin())
  WITH CHECK (bucket_id = 'participant-photos' AND public.is_active_admin());
DROP POLICY IF EXISTS participant_photos_admin_delete ON storage.objects;
CREATE POLICY participant_photos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'participant-photos' AND public.is_active_admin());

-- Reporting layer: dimensional views over the normalized operational model.
CREATE VIEW analytics.dim_date WITH (security_invoker = true) AS
SELECT
  (extract(year FROM d)::integer * 10000 + extract(month FROM d)::integer * 100 + extract(day FROM d)::integer) AS date_key,
  d::date AS full_date,
  extract(year FROM d)::integer AS calendar_year,
  extract(quarter FROM d)::integer AS calendar_quarter,
  extract(month FROM d)::integer AS calendar_month,
  trim(to_char(d, 'TMMonth')) AS month_name,
  extract(day FROM d)::integer AS day_of_month,
  extract(isodow FROM d)::integer AS weekday_iso,
  trim(to_char(d, 'TMDay')) AS weekday_name,
  extract(isodow FROM d)::integer IN (1, 3) AS is_regular_meeting_day
FROM generate_series('2000-01-01'::date, '2100-12-31'::date, interval '1 day') AS series(d);

CREATE VIEW analytics.dim_participant WITH (security_invoker = true) AS
SELECT id AS participant_id, cpf, name, active, birth_date, created_at
FROM public.participants;

CREATE VIEW analytics.dim_meeting WITH (security_invoker = true) AS
SELECT m.id AS meeting_id,
       (extract(year FROM m.meeting_date)::integer * 10000 + extract(month FROM m.meeting_date)::integer * 100 + extract(day FROM m.meeting_date)::integer) AS date_key,
       m.meeting_date, m.notes, m.created_at
FROM public.meetings AS m;

CREATE VIEW analytics.fact_attendance WITH (security_invoker = true) AS
SELECT a.id AS attendance_id,
       dm.date_key,
       a.participant_id,
       a.meeting_id,
       a.status,
       a.notes,
       1::integer AS attendance_count,
       a.created_at
FROM public.attendance AS a
JOIN public.meetings AS m ON m.id = a.meeting_id
JOIN analytics.dim_meeting AS dm ON dm.meeting_id = m.id;

GRANT SELECT ON analytics.dim_date, analytics.dim_participant, analytics.dim_meeting, analytics.fact_attendance TO authenticated;

COMMIT;
