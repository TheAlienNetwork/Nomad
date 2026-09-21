-- Cover metadata, note kind, and synced memoir prefs.
-- RLS policies already restrict these tables to auth.uid().

ALTER TABLE nomad_journal_notes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS cover_storage_path text,
  ADD COLUMN IF NOT EXISTS cover_sketch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_x double precision,
  ADD COLUMN IF NOT EXISTS cover_y double precision,
  ADD COLUMN IF NOT EXISTS cover_width double precision,
  ADD COLUMN IF NOT EXISTS cover_height double precision;

ALTER TABLE nomad_user_prefs
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '{}'::jsonb;
