-- Add cash tracking and team features to user_stats

DO $$
BEGIN
  -- Add cash_collected column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'cash_collected'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN cash_collected numeric(10,2) DEFAULT 0;
  END IF;

  -- Add cash_collected_goal column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'cash_collected_goal'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN cash_collected_goal numeric(10,2) DEFAULT 10000;
  END IF;

  -- Add team_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN team_id uuid;
  END IF;

  -- Add display_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN display_name text;
  END IF;
END $$;

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  total_cash_collected numeric(10,2) DEFAULT 0,
  total_appointments integer DEFAULT 0,
  total_calls integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Policies for teams
CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert teams"
  ON teams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update teams"
  ON teams FOR UPDATE
  USING (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_stats_team_id ON user_stats(team_id);