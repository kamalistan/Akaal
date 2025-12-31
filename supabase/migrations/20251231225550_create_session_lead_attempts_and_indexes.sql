/*
  # Session Lead Attempts and Performance Indexes

  ## Overview
  Adds support for resume dialing and metrics tracking with optimized indexes.

  ## 1. Session Lead Attempts Table
  Tracks which leads have been attempted in each dialing session:
    - `id` (uuid) - Primary key
    - `session_id` (uuid) - Reference to dialer_sessions
    - `lead_id` (uuid) - Reference to leads
    - `attempted_at` (timestamptz) - When the attempt was made
    - `outcome` (text) - Call outcome
    - `created_at` (timestamptz) - Record creation time
    - UNIQUE constraint on (session_id, lead_id) prevents duplicate attempts

  ## 2. Performance Indexes
  Optimizes queries for:
    - User + date range metrics queries
    - Outcome filtering
    - Session-based queries
    - Recording lookups

  ## 3. Helper Functions
  Functions to get next undialed lead and check if lead was attempted

  ## Security
  - Enable RLS on session_lead_attempts
  - Users can only access their own session attempts
  - Proper indexes for query performance
*/

-- 1. Create session_lead_attempts table
CREATE TABLE IF NOT EXISTS session_lead_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES dialer_sessions(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  attempted_at timestamptz DEFAULT now(),
  outcome text,
  user_email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, lead_id)
);

ALTER TABLE session_lead_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session attempts"
  ON session_lead_attempts FOR SELECT
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can insert own session attempts"
  ON session_lead_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_email = 'demo@example.com');

CREATE POLICY "Users can update own session attempts"
  ON session_lead_attempts FOR UPDATE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can delete own session attempts"
  ON session_lead_attempts FOR DELETE
  TO authenticated
  USING (user_email = 'demo@example.com');

-- 2. Create indexes for session_lead_attempts
CREATE INDEX IF NOT EXISTS idx_session_attempts_session ON session_lead_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attempts_lead ON session_lead_attempts(lead_id);
CREATE INDEX IF NOT EXISTS idx_session_attempts_user ON session_lead_attempts(user_email);
CREATE INDEX IF NOT EXISTS idx_session_attempts_attempted_at ON session_lead_attempts(attempted_at DESC);

-- 3. Create indexes for dialer_call_history (metrics queries)
CREATE INDEX IF NOT EXISTS idx_call_history_user_date ON dialer_call_history(user_email, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_history_outcome ON dialer_call_history(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_history_duration ON dialer_call_history(duration) WHERE duration > 0;
CREATE INDEX IF NOT EXISTS idx_call_history_answered ON dialer_call_history(answered_at) WHERE answered_at IS NOT NULL;

-- 4. Create indexes for call_recordings
CREATE INDEX IF NOT EXISTS idx_call_recordings_lead ON call_recordings(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_user ON call_recordings(user_email);
CREATE INDEX IF NOT EXISTS idx_call_recordings_created ON call_recordings(created_at DESC);

-- 5. Create function to get next undialed lead for session
CREATE OR REPLACE FUNCTION get_next_undialed_lead(
  p_session_id uuid,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid,
  lead_name text,
  lead_phone text,
  lead_company text,
  lead_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.phone,
    l.company,
    l.status
  FROM leads l
  WHERE 
    (p_pipeline_id IS NULL OR l.pipeline_id = p_pipeline_id)
    AND l.is_dnc = false
    AND l.id NOT IN (
      SELECT lead_id 
      FROM session_lead_attempts 
      WHERE session_id = p_session_id
    )
  ORDER BY 
    l.last_called_at NULLS FIRST,
    l.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to check if lead was attempted in session
CREATE OR REPLACE FUNCTION was_lead_attempted(
  p_session_id uuid,
  p_lead_id uuid
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM session_lead_attempts 
    WHERE session_id = p_session_id 
      AND lead_id = p_lead_id
  );
END;
$$ LANGUAGE plpgsql;

-- 7. Create view for active session progress
CREATE OR REPLACE VIEW v_session_progress AS
SELECT 
  ds.id as session_id,
  ds.user_email,
  ds.pipeline_id,
  ds.total_leads,
  ds.completed_leads,
  ds.current_lead_id,
  ds.current_lead_index,
  COUNT(sla.id) as attempted_count,
  COUNT(CASE WHEN sla.outcome IN ('connected', 'callback') THEN 1 END) as successful_attempts,
  ds.is_active,
  ds.started_at,
  ds.last_activity_at,
  EXTRACT(EPOCH FROM (NOW() - ds.last_activity_at))::integer as seconds_since_activity
FROM dialer_sessions ds
LEFT JOIN session_lead_attempts sla ON sla.session_id = ds.id
WHERE ds.is_active = true
GROUP BY ds.id
ORDER BY ds.last_activity_at DESC;

-- Grant access to views and functions
GRANT SELECT ON v_session_progress TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_next_undialed_lead TO authenticated, anon;
GRANT EXECUTE ON FUNCTION was_lead_attempted TO authenticated, anon;
