-- Named hunt areas and trail-camera check-ins. RLS is auth.uid() only.

CREATE TABLE IF NOT EXISTS nomad_hunt_areas (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  west double precision NOT NULL,
  south double precision NOT NULL,
  east double precision NOT NULL,
  north double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS nomad_trail_cameras (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  waypoint_id text,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  installed_at timestamptz,
  last_checked timestamptz,
  status text NOT NULL DEFAULT 'active',
  notes text,
  photos jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE nomad_hunt_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomad_trail_cameras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nomad_hunt_areas_own ON nomad_hunt_areas;
CREATE POLICY nomad_hunt_areas_own ON nomad_hunt_areas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS nomad_trail_cameras_own ON nomad_trail_cameras;
CREATE POLICY nomad_trail_cameras_own ON nomad_trail_cameras
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
