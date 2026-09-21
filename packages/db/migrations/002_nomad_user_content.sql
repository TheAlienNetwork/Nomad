-- Nomad hunter writing and kit. RLS is auth.uid() only.
-- No GIS, parcels, seasons, or hunting-unit rows.

CREATE TABLE IF NOT EXISTS nomad_gear (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  packed boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nomad_journal_notes (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ink_color text NOT NULL DEFAULT 'walnut',
  font_family text NOT NULL DEFAULT 'serif'
);

CREATE TABLE IF NOT EXISTS nomad_hunt_plans (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  planned_at timestamptz NOT NULL,
  species text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  notes text NOT NULL DEFAULT '',
  ink_color text NOT NULL DEFAULT 'walnut',
  font_family text NOT NULL DEFAULT 'serif',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nomad_memoir_pages (
  hunt_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  area_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  ink_color text NOT NULL DEFAULT 'walnut',
  font_family text NOT NULL DEFAULT 'serif',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hunt_id)
);

CREATE TABLE IF NOT EXISTS nomad_user_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  journal_style text NOT NULL DEFAULT 'field'
);

CREATE TABLE IF NOT EXISTS nomad_page_sketches (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  page_id text NOT NULL,
  storage_path text NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  width double precision NOT NULL,
  height double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nomad_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_journal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_hunt_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_memoir_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_user_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_page_sketches ENABLE ROW LEVEL SECURITY;

CREATE POLICY nomad_gear_own ON nomad_gear
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY nomad_journal_notes_own ON nomad_journal_notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY nomad_hunt_plans_own ON nomad_hunt_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY nomad_memoir_pages_own ON nomad_memoir_pages
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY nomad_user_prefs_own ON nomad_user_prefs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY nomad_page_sketches_own ON nomad_page_sketches
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('memoir-sketches', 'memoir-sketches', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY nomad_memoir_sketches_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'memoir-sketches' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY nomad_memoir_sketches_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'memoir-sketches' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY nomad_memoir_sketches_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'memoir-sketches' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'memoir-sketches' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY nomad_memoir_sketches_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'memoir-sketches' AND (storage.foldername(name))[1] = auth.uid()::text);
