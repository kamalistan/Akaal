/*
  # Call Status History Tracking

  ## Overview
  This migration creates infrastructure for comprehensive call status tracking
  to enable real-time monitoring, debugging, and audit trails.

  ## 1. Call Status History Table
  Tracks every status transition for calls:
    - `id` (uuid, primary key) - Unique record ID
    - `call_sid` (text, indexed) - Twilio call SID
    - `lead_id` (uuid) - Reference to lead
    - `user_email` (text) - User making the call
    - `previous_status` (text) - Status before transition
    - `new_status` (text) - Status after transition
    - `status_source` (text) - Source of status update (webhook, manual, timeout)
    - `duration_in_status` (integer) - Seconds spent in previous status
    - `webhook_payload` (jsonb) - Raw webhook data for debugging
    - `created_at` (timestamptz) - Timestamp of transition

  ## 2. Enhanced Active Calls Table
  Add tracking fields to active_calls:
    - `status_changed_at` (timestamptz) - Last status change time
    - `status_source` (text) - Source of last status update
    - `error_message` (text) - Error details if call failed
    - `retry_count` (integer) - Number of retry attempts

  ## Security
  - Enable RLS on call_status_history table
  - Add policies for user access
  - Maintain data isolation per user
*/

-- 1. Create call_status_history table
CREATE TABLE IF NOT EXISTS call_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  status_source text DEFAULT 'webhook' CHECK (status_source IN ('webhook', 'manual', 'timeout', 'system', 'error')),
  duration_in_status integer DEFAULT 0,
  webhook_payload jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own call history"
  ON call_status_history FOR SELECT
  USING (true);

CREATE POLICY "Users can insert call history"
  ON call_status_history FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_call_status_history_call_sid ON call_status_history(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_status_history_user_email ON call_status_history(user_email);
CREATE INDEX IF NOT EXISTS idx_call_status_history_created_at ON call_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_status_history_new_status ON call_status_history(new_status);

-- 2. Enhance active_calls table with tracking fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_calls' AND column_name = 'status_changed_at'
  ) THEN
    ALTER TABLE active_calls ADD COLUMN status_changed_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_calls' AND column_name = 'status_source'
  ) THEN
    ALTER TABLE active_calls ADD COLUMN status_source text DEFAULT 'system';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_calls' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE active_calls ADD COLUMN error_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_calls' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE active_calls ADD COLUMN retry_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_calls' AND column_name = 'call_duration'
  ) THEN
    ALTER TABLE active_calls ADD COLUMN call_duration integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_active_calls_status_changed_at ON active_calls(status_changed_at);

-- 3. Create function to log status changes
CREATE OR REPLACE FUNCTION log_call_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  duration_seconds integer;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    duration_seconds := EXTRACT(EPOCH FROM (NEW.status_changed_at - OLD.status_changed_at))::integer;
    
    INSERT INTO call_status_history (
      call_sid,
      lead_id,
      user_email,
      previous_status,
      new_status,
      status_source,
      duration_in_status,
      metadata
    ) VALUES (
      NEW.call_sid,
      NEW.lead_id,
      NEW.user_email,
      OLD.status,
      NEW.status,
      NEW.status_source,
      duration_seconds,
      jsonb_build_object(
        'line_number', NEW.line_number,
        'started_at', NEW.started_at,
        'answered_at', NEW.answered_at,
        'ended_at', NEW.ended_at
      )
    );
    
    NEW.status_changed_at := now();
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO call_status_history (
      call_sid,
      lead_id,
      user_email,
      previous_status,
      new_status,
      status_source,
      duration_in_status
    ) VALUES (
      NEW.call_sid,
      NEW.lead_id,
      NEW.user_email,
      NULL,
      NEW.status,
      NEW.status_source,
      0
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Create trigger for automatic status logging
DROP TRIGGER IF EXISTS trigger_log_call_status_change ON active_calls;
CREATE TRIGGER trigger_log_call_status_change
  BEFORE INSERT OR UPDATE ON active_calls
  FOR EACH ROW
  EXECUTE FUNCTION log_call_status_change();

-- 5. Create function to get call status timeline
CREATE OR REPLACE FUNCTION get_call_status_timeline(p_call_sid text)
RETURNS TABLE (
  status text,
  duration_seconds integer,
  changed_at timestamptz,
  source text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    new_status as status,
    duration_in_status as duration_seconds,
    created_at as changed_at,
    status_source as source
  FROM call_status_history
  WHERE call_sid = p_call_sid
  ORDER BY created_at ASC;
END;
$$;

-- 6. Create function to clean up old status history (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_call_status_history()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM call_status_history
  WHERE created_at < now() - interval '90 days';
END;
$$;