-- HUNT//OS authoritative schema (PostgreSQL + PostGIS)
-- Apply with: psql "$DATABASE_URL" -f packages/db/migrations/001_foundation.sql
-- Geometry stays on the server. Clients receive tiles, bbox queries, or small GeoJSON.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name text,
  home_state text,
  preferred_species text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS states (
  code text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  notes text
);

CREATE TABLE IF NOT EXISTS species (
  id text PRIMARY KEY,
  common_name text NOT NULL,
  scientific_name text
);

CREATE TABLE IF NOT EXISTS datasets (
  dataset_id text PRIMARY KEY,
  name text NOT NULL,
  agency text NOT NULL,
  jurisdiction text NOT NULL,
  species text,
  data_type text NOT NULL,
  source_url text NOT NULL DEFAULT '',
  service_type text NOT NULL,
  layer_identifier text,
  version text,
  effective_date date,
  retrieved_at timestamptz,
  last_verified_at timestamptz,
  license text,
  attribution text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  enabled boolean NOT NULL DEFAULT false,
  notes text
);

CREATE TABLE IF NOT EXISTS dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id text NOT NULL REFERENCES datasets (dataset_id) ON DELETE CASCADE,
  version text,
  retrieved_at timestamptz NOT NULL,
  checksum text,
  feature_count integer,
  validation_status text NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS public_land_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id text NOT NULL REFERENCES datasets (dataset_id),
  dataset_version_id uuid REFERENCES dataset_versions (id),
  source_feature_id text,
  name text,
  manager text,
  manager_type text,
  access_code text,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  retrieved_at timestamptz NOT NULL,
  truth_layer text NOT NULL DEFAULT 'authoritative' CHECK (truth_layer = 'authoritative')
);

CREATE INDEX IF NOT EXISTS public_land_features_gix
  ON public_land_features USING gist (geom);
CREATE INDEX IF NOT EXISTS public_land_features_dataset_idx
  ON public_land_features (dataset_id);

CREATE TABLE IF NOT EXISTS public_access_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id text NOT NULL REFERENCES datasets (dataset_id),
  name text,
  access_type text,
  geom geometry(Geometry, 4326) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  retrieved_at timestamptz NOT NULL,
  truth_layer text NOT NULL DEFAULT 'authoritative'
);

CREATE INDEX IF NOT EXISTS public_access_features_gix
  ON public_access_features USING gist (geom);

CREATE TABLE IF NOT EXISTS hunting_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id text NOT NULL REFERENCES datasets (dataset_id),
  state_code text NOT NULL REFERENCES states (code),
  unit_code text NOT NULL,
  name text,
  species text,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  retrieved_at timestamptz NOT NULL,
  truth_layer text NOT NULL DEFAULT 'authoritative',
  UNIQUE (state_code, unit_code, species)
);

CREATE INDEX IF NOT EXISTS hunting_units_gix ON hunting_units USING gist (geom);

CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL REFERENCES states (code),
  species text NOT NULL,
  unit_code text,
  name text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  weapon text,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  truth_layer text NOT NULL DEFAULT 'authoritative'
);

CREATE TABLE IF NOT EXISTS regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL REFERENCES states (code),
  species text,
  title text NOT NULL,
  body text NOT NULL,
  source_url text NOT NULL,
  effective_date date,
  retrieved_at timestamptz NOT NULL,
  truth_layer text NOT NULL DEFAULT 'authoritative'
);

CREATE TABLE IF NOT EXISTS hunt_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  geom geometry(Polygon, 4326) NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS hunt_areas_gix ON hunt_areas USING gist (geom);
CREATE INDEX IF NOT EXISTS hunt_areas_user_idx ON hunt_areas (user_id);

CREATE TABLE IF NOT EXISTS waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  hunt_area_id uuid REFERENCES hunt_areas (id) ON DELETE SET NULL,
  type text NOT NULL,
  name text NOT NULL,
  notes text,
  geom geography(Point, 4326) NOT NULL,
  elevation double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  observed_at timestamptz,
  photos jsonb NOT NULL DEFAULT '[]',
  weather_snapshot_id uuid,
  species text,
  tags jsonb NOT NULL DEFAULT '[]',
  visibility text NOT NULL DEFAULT 'private',
  sync_status text NOT NULL DEFAULT 'synced',
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS waypoints_gix ON waypoints USING gist (geom);
CREATE INDEX IF NOT EXISTS waypoints_user_idx ON waypoints (user_id);

CREATE TABLE IF NOT EXISTS tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  hunt_id uuid,
  name text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL,
  geom geometry(LineString, 4326),
  distance_meters double precision,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS track_points (
  id bigserial PRIMARY KEY,
  track_id uuid NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  accuracy_m double precision,
  altitude_m double precision,
  speed_mps double precision,
  heading double precision
);

CREATE INDEX IF NOT EXISTS track_points_track_idx ON track_points (track_id, recorded_at);
CREATE INDEX IF NOT EXISTS track_points_gix ON track_points USING gist (geom);

CREATE TABLE IF NOT EXISTS hunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  species text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  area_id uuid REFERENCES hunt_areas (id),
  track_id uuid REFERENCES tracks (id),
  distance_meters double precision,
  notes text,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  hunt_id uuid REFERENCES hunts (id) ON DELETE SET NULL,
  waypoint_id uuid REFERENCES waypoints (id) ON DELETE SET NULL,
  species text,
  notes text,
  geom geography(Point, 4326) NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  visibility text NOT NULL DEFAULT 'private',
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS observations_gix ON observations USING gist (geom);

CREATE TABLE IF NOT EXISTS trail_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  installed_at timestamptz,
  last_checked timestamptz,
  status text NOT NULL DEFAULT 'unknown',
  notes text,
  photos jsonb NOT NULL DEFAULT '[]',
  visibility text NOT NULL DEFAULT 'private',
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trail_camera_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid NOT NULL REFERENCES trail_cameras (id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  captured_at timestamptz,
  analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weather_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS terrain_cells (
  id text PRIMARY KEY,
  dataset_id text REFERENCES datasets (dataset_id),
  geom geometry(Polygon, 4326) NOT NULL,
  elevation_m double precision,
  slope_deg double precision,
  aspect_deg double precision,
  land_cover text,
  retrieved_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS terrain_cells_gix ON terrain_cells USING gist (geom);

CREATE TABLE IF NOT EXISTS habitat_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id text NOT NULL,
  species text NOT NULL,
  scores jsonb NOT NULL,
  confidence double precision NOT NULL,
  reasons jsonb NOT NULL,
  missing jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  truth_layer text NOT NULL DEFAULT 'inferred' CHECK (truth_layer = 'inferred')
);

CREATE TABLE IF NOT EXISTS ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id),
  species text NOT NULL,
  bounds geometry(Polygon, 4326) NOT NULL,
  explanation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  truth_layer text NOT NULL DEFAULT 'inferred'
);

CREATE TABLE IF NOT EXISTS offline_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  geom geometry(Polygon, 4326) NOT NULL,
  min_zoom integer NOT NULL,
  max_zoom integer NOT NULL,
  estimated_bytes bigint,
  last_update timestamptz,
  dataset_versions jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued'
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  local_id text NOT NULL,
  entity_type text NOT NULL,
  op text NOT NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL,
  sync_status text NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_queue_user_status_idx
  ON sync_queue (user_id, sync_status);

INSERT INTO states (code, name, enabled, notes) VALUES
  ('TX', 'Texas', true, 'First fully configured state target.'),
  ('CO', 'Colorado', false, 'Western expansion — adapter only.'),
  ('WY', 'Wyoming', false, 'Western expansion — adapter only.'),
  ('MT', 'Montana', false, 'Western expansion — adapter only.'),
  ('ID', 'Idaho', false, 'Western expansion — adapter only.'),
  ('UT', 'Utah', false, 'Western expansion — adapter only.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO species (id, common_name, scientific_name) VALUES
  ('whitetail', 'Whitetail deer', 'Odocoileus virginianus'),
  ('mule_deer', 'Mule deer', 'Odocoileus hemionus'),
  ('elk', 'Elk', 'Cervus canadensis'),
  ('turkey', 'Wild turkey', 'Meleagris gallopavo')
ON CONFLICT (id) DO NOTHING;
