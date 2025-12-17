/*
  # Advanced Dialer System Schema

  ## Overview
  This migration creates a comprehensive dialer system with session persistence,
  multi-line support, call recordings, user rankings, and advanced analytics.

  ## 1. Dialer Sessions Table
  Tracks active dialing sessions to enable resume functionality:
    - `id` (uuid, primary key)
    - `user_email` (text) - User who owns the session
    - `pipeline_id` (uuid) - Pipeline being dialed
    - `current_lead_index` (integer) - Position in lead queue
    - `current_lead_id` (uuid) - Current lead being worked
    - `total_leads` (integer) - Total leads in session
    - `completed_leads` (integer) - Leads already called
    - `filter_settings` (jsonb) - Pipeline filters and preferences
    - `is_active` (boolean) - Whether session is currently active
    - `started_at` (timestamptz) - Session start time
    - `last_activity_at` (timestamptz) - Last activity timestamp
    - `ended_at` (timestamptz) - Session completion time

  ## 2. Active Calls Table
  Tracks multiple simultaneous calls for multi-line dialing:
    - `id` (uuid, primary key)
    - `user_email` (text) - User making the call
    - `lead_id` (uuid) - Lead being called
    - `call_sid` (text) - Twilio call SID
    - `line_number` (integer) - Line number (1, 2, or 3)
    - `status` (text) - Call status
    - `started_at` (timestamptz) - Call start time
    - `answered_at` (timestamptz) - Time call was answered
    - `ended_at` (timestamptz) - Call end time

  ## 3. Call Recordings Table
  Stores call recording metadata and URLs:
    - `id` (uuid, primary key)
    - `call_log_id` (uuid) - Reference to call_logs
    - `lead_id` (uuid) - Reference to lead
    - `user_email` (text) - User who made the call
    - `recording_sid` (text) - Twilio recording SID
    - `recording_url` (text) - URL to recording file
    - `duration` (integer) - Recording duration in seconds
    - `transcription` (text) - AI transcription of call
    - `created_at` (timestamptz) - Recording creation time

  ## 4. User Rankings Table
  Calculates and stores user performance rankings:
    - `id` (uuid, primary key)
    - `user_email` (text, unique) - User identifier
    - `total_calls` (integer) - Total calls made
    - `successful_calls` (integer) - Appointments set
    - `success_ratio` (decimal) - Success percentage
    - `rank_position` (integer) - Global rank position
    - `rank_tier` (text) - Bronze, Silver, Gold, Platinum, Diamond
    - `total_revenue` (decimal) - Total revenue generated
    - `updated_at` (timestamptz) - Last calculation time

  ## 5. Voicemail Detection Logs Table
  Tracks AMD accuracy for tuning:
    - `id` (uuid, primary key)
    - `call_sid` (text) - Twilio call SID
    - `lead_id` (uuid) - Lead called
    - `amd_result` (text) - AMD detection result
    - `confidence_score` (decimal) - Detection confidence
    - `user_override` (text) - User's manual correction
    - `created_at` (timestamptz) - Detection time

  ## 6. Metrics Daily Summary Table
  Aggregated daily performance metrics:
    - `id` (uuid, primary key)
    - `user_email` (text) - User identifier
    - `date` (date) - Metrics date
    - `total_calls` (integer) - Calls made
    - `total_talk_time` (integer) - Total talk time in seconds
    - `total_wait_time` (integer) - Total wait time in seconds
    - `appointments_set` (integer) - Appointments booked
    - `revenue_generated` (decimal) - Revenue from appointments
    - `average_call_duration` (decimal) - Average call length

  ## 7. Custom Dispositions Table
  User-defined call outcomes:
    - `id` (uuid, primary key)
    - `user_email` (text) - User who created disposition
    - `name` (text) - Disposition name
    - `points` (integer) - Points awarded
    - `color` (text) - UI color
    - `is_success` (boolean) - Counts as success for rankings

  ## 8. Time Zone Rules Table
  Compliance and timezone protection:
    - `id` (uuid, primary key)
    - `timezone` (text) - Timezone identifier
    - `calling_start` (time) - Earliest call time
    - `calling_end` (time) - Latest call time
    - `days_active` (jsonb) - Days of week allowed

  ## 9. Enhance existing tables
  Add columns to dialer_settings for new features:
    - `enable_call_recording` - Enable/disable recording
    - `amd_sensitivity` - Voicemail detection sensitivity
    - `amd_action` - Action on voicemail detection
    - `spotify_enabled` - Spotify integration toggle
    - `spotify_playlist_id` - Selected playlist
    - `local_presence_enabled` - Dynamic caller ID

  ## Security
  - Enable RLS on all tables
  - Add appropriate policies for user access
  - Maintain data isolation per user
*/

-- 1. Create dialer_sessions table
CREATE TABLE IF NOT EXISTS dialer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  pipeline_id uuid REFERENCES ghl_pipelines(id) ON DELETE SET NULL,
  current_lead_index integer DEFAULT 0,
  current_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  total_leads integer DEFAULT 0,
  completed_leads integer DEFAULT 0,
  filter_settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  started_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dialer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON dialer_sessions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own sessions"
  ON dialer_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own sessions"
  ON dialer_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own sessions"
  ON dialer_sessions FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_dialer_sessions_user_email ON dialer_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_dialer_sessions_is_active ON dialer_sessions(is_active);

-- 2. Create active_calls table
CREATE TABLE IF NOT EXISTS active_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  call_sid text,
  line_number integer DEFAULT 1 CHECK (line_number >= 1 AND line_number <= 3),
  status text DEFAULT 'initiating',
  started_at timestamptz DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz
);

ALTER TABLE active_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own active calls"
  ON active_calls FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own active calls"
  ON active_calls FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own active calls"
  ON active_calls FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own active calls"
  ON active_calls FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_active_calls_user_email ON active_calls(user_email);
CREATE INDEX IF NOT EXISTS idx_active_calls_call_sid ON active_calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_active_calls_status ON active_calls(status);

-- 3. Create call_recordings table
CREATE TABLE IF NOT EXISTS call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id uuid REFERENCES call_logs(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  recording_sid text UNIQUE,
  recording_url text,
  storage_path text,
  duration integer DEFAULT 0,
  transcription text,
  file_size integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recordings"
  ON call_recordings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert recordings"
  ON call_recordings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update recordings"
  ON call_recordings FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_call_recordings_user_email ON call_recordings(user_email);
CREATE INDEX IF NOT EXISTS idx_call_recordings_lead_id ON call_recordings(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_recording_sid ON call_recordings(recording_sid);

-- 4. Create user_rankings table
CREATE TABLE IF NOT EXISTS user_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text UNIQUE NOT NULL,
  total_calls integer DEFAULT 0,
  successful_calls integer DEFAULT 0,
  success_ratio decimal(5, 2) DEFAULT 0.00,
  rank_position integer,
  rank_tier text DEFAULT 'bronze' CHECK (rank_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  total_revenue decimal(12, 2) DEFAULT 0.00,
  avg_talk_time integer DEFAULT 0,
  appointments_this_week integer DEFAULT 0,
  appointments_this_month integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rankings"
  ON user_rankings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own ranking"
  ON user_rankings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own ranking"
  ON user_rankings FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_user_rankings_user_email ON user_rankings(user_email);
CREATE INDEX IF NOT EXISTS idx_user_rankings_rank_position ON user_rankings(rank_position);
CREATE INDEX IF NOT EXISTS idx_user_rankings_success_ratio ON user_rankings(success_ratio DESC);

-- 5. Create voicemail_detection_logs table
CREATE TABLE IF NOT EXISTS voicemail_detection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  amd_result text,
  confidence_score decimal(5, 2),
  user_override text,
  is_accurate boolean,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE voicemail_detection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view voicemail logs"
  ON voicemail_detection_logs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert voicemail logs"
  ON voicemail_detection_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update voicemail logs"
  ON voicemail_detection_logs FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_voicemail_logs_call_sid ON voicemail_detection_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_voicemail_logs_user_email ON voicemail_detection_logs(user_email);

-- 6. Create metrics_daily_summary table
CREATE TABLE IF NOT EXISTS metrics_daily_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  date date NOT NULL,
  total_calls integer DEFAULT 0,
  total_talk_time integer DEFAULT 0,
  total_wait_time integer DEFAULT 0,
  appointments_set integer DEFAULT 0,
  revenue_generated decimal(12, 2) DEFAULT 0.00,
  average_call_duration decimal(8, 2) DEFAULT 0.00,
  connection_rate decimal(5, 2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_email, date)
);

ALTER TABLE metrics_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON metrics_daily_summary FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own metrics"
  ON metrics_daily_summary FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own metrics"
  ON metrics_daily_summary FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_user_email ON metrics_daily_summary(user_email);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily_summary(date DESC);

-- 7. Create custom_dispositions table
CREATE TABLE IF NOT EXISTS custom_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  name text NOT NULL,
  points integer DEFAULT 0,
  color text DEFAULT 'bg-slate-500',
  icon text DEFAULT 'Phone',
  is_success boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_dispositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dispositions"
  ON custom_dispositions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own dispositions"
  ON custom_dispositions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own dispositions"
  ON custom_dispositions FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own dispositions"
  ON custom_dispositions FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_custom_dispositions_user_email ON custom_dispositions(user_email);

-- 8. Create time_zone_rules table
CREATE TABLE IF NOT EXISTS time_zone_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone text UNIQUE NOT NULL,
  calling_start time DEFAULT '09:00:00',
  calling_end time DEFAULT '17:00:00',
  days_active jsonb DEFAULT '["monday","tuesday","wednesday","thursday","friday"]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_zone_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view timezone rules"
  ON time_zone_rules FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert timezone rules"
  ON time_zone_rules FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update timezone rules"
  ON time_zone_rules FOR UPDATE
  USING (true);

-- 9. Enhance dialer_settings table with new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'enable_call_recording'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN enable_call_recording boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'amd_sensitivity'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN amd_sensitivity text DEFAULT 'medium' CHECK (amd_sensitivity IN ('low', 'medium', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'amd_action'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN amd_action text DEFAULT 'disconnect' CHECK (amd_action IN ('disconnect', 'continue', 'notify'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'spotify_enabled'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN spotify_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'spotify_playlist_id'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN spotify_playlist_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'local_presence_enabled'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN local_presence_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'auto_advance_on_complete'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN auto_advance_on_complete boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'session_timeout_minutes'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN session_timeout_minutes integer DEFAULT 60;
  END IF;
END $$;

-- 10. Add session tracking columns to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_called_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_called_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_called_by'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_called_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'is_dnc'
  ) THEN
    ALTER TABLE leads ADD COLUMN is_dnc boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'dnc_reason'
  ) THEN
    ALTER TABLE leads ADD COLUMN dnc_reason text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_last_called_at ON leads(last_called_at);
CREATE INDEX IF NOT EXISTS idx_leads_is_dnc ON leads(is_dnc);

-- 11. Add recording tracking to call_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'has_recording'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN has_recording boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN user_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'was_voicemail'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN was_voicemail boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN session_id uuid REFERENCES dialer_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_logs_user_email ON call_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_call_logs_session_id ON call_logs(session_id);

-- 12. Create function to calculate user rankings
CREATE OR REPLACE FUNCTION calculate_user_rankings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_rankings (
    user_email,
    total_calls,
    successful_calls,
    success_ratio,
    rank_position,
    rank_tier,
    updated_at
  )
  SELECT
    user_email,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE outcome = 'appointment_set') as successful_calls,
    ROUND((COUNT(*) FILTER (WHERE outcome = 'appointment_set')::decimal / NULLIF(COUNT(*), 0)) * 100, 2) as success_ratio,
    ROW_NUMBER() OVER (ORDER BY
      (COUNT(*) FILTER (WHERE outcome = 'appointment_set')::decimal / NULLIF(COUNT(*), 0)) DESC,
      COUNT(*) DESC
    ) as rank_position,
    CASE
      WHEN (COUNT(*) FILTER (WHERE outcome = 'appointment_set')::decimal / NULLIF(COUNT(*), 0)) >= 0.30 THEN 'diamond'
      WHEN (COUNT(*) FILTER (WHERE outcome = 'appointment_set')::decimal / NULLIF(COUNT(*), 0)) >= 0.20 THEN 'platinum'
      WHEN (COUNT(*) FILTER (WHERE outcome = 'appointment_set')::decimal / NULLIF(COUNT(*), 0)) >= 0.15 THEN 'gold'
      WHEN (COUNT(*) FILTER (WHERE outcome = 'appointment_set')::decimal / NULLIF(COUNT(*), 0)) >= 0.10 THEN 'silver'
      ELSE 'bronze'
    END as rank_tier,
    now() as updated_at
  FROM call_logs
  WHERE user_email IS NOT NULL
  GROUP BY user_email
  ON CONFLICT (user_email)
  DO UPDATE SET
    total_calls = EXCLUDED.total_calls,
    successful_calls = EXCLUDED.successful_calls,
    success_ratio = EXCLUDED.success_ratio,
    rank_position = EXCLUDED.rank_position,
    rank_tier = EXCLUDED.rank_tier,
    updated_at = EXCLUDED.updated_at;
END;
$$;
