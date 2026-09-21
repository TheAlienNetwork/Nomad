-- Hunter-drawn field marks. RLS is auth.uid() only.
-- Waypoints, kills, hunts, tracks, and scout areas — not GIS or hunt units.

CREATE TABLE IF NOT EXISTS nomad_waypoints (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  notes text,
  species text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  elevation double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  observed_at timestamptz,
  photos jsonb NOT NULL DEFAULT '[]',
  tags jsonb NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS nomad_hunts (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  species text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  track_id text,
  distance_meters double precision,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS nomad_tracks (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  hunt_id text,
  name text NOT NULL DEFAULT 'Track',
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'stopped',
  points jsonb NOT NULL DEFAULT '[]',
  distance_meters double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS nomad_scout_areas (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'rust',
  radius_meters double precision NOT NULL DEFAULT 183,
  points jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE nomad_user_prefs
  ADD COLUMN IF NOT EXISTS basemap text,
  ADD COLUMN IF NOT EXISTS layers jsonb,
  ADD COLUMN IF NOT EXISTS truck_waypoint_id text,
  ADD COLUMN IF NOT EXISTS public_land_opacity double precision;

ALTER TABLE nomad_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_hunts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_scout_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nomad_waypoints_own ON nomad_waypoints;
CREATE POLICY nomad_waypoints_own ON nomad_waypoints
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS nomad_hunts_own ON nomad_hunts;
CREATE POLICY nomad_hunts_own ON nomad_hunts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS nomad_tracks_own ON nomad_tracks;
CREATE POLICY nomad_tracks_own ON nomad_tracks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS nomad_scout_areas_own ON nomad_scout_areas;
CREATE POLICY nomad_scout_areas_own ON nomad_scout_areas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
