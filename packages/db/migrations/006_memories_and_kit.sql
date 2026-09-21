-- Private memories gallery and kit grouping. RLS is auth.uid() only.

CREATE TABLE IF NOT EXISTS nomad_memories (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  storage_path text NOT NULL DEFAULT '',
  caption text,
  lat double precision,
  lng double precision,
  taken_at timestamptz NOT NULL DEFAULT now(),
  place_label text,
  width double precision,
  height double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nomad_gear (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  packed boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  kit_group text NOT NULL DEFAULT 'Custom',
  essential boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nomad_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_gear ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nomad_memories_own ON nomad_memories;
CREATE POLICY nomad_memories_own ON nomad_memories
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS nomad_gear_own ON nomad_gear;
CREATE POLICY nomad_gear_own ON nomad_gear
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE nomad_gear
  ADD COLUMN IF NOT EXISTS kit_group text NOT NULL DEFAULT 'Custom',
  ADD COLUMN IF NOT EXISTS essential boolean NOT NULL DEFAULT false;
