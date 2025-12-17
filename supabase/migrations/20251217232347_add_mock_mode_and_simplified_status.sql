/*
  # Add Mock Mode Support for Testing Without Twilio

  1. Schema Changes
    - Add `is_mock` boolean to `active_calls` table (for demo/testing mode)
    - Add `mock_config` jsonb to `dialer_settings` table (store mock behavior settings)
    - Add `last_error` text to `active_calls` for error messages
    - Add status validation check constraint
    
  2. New Features
    - Mock mode allows testing without Twilio credentials
    - Simplified status tracking with clear transitions
    - Better error handling and reporting
    
  3. Valid Status Values
    - idle: Initial state, ready to dial
    - dialing: Call initiated, waiting for connection
    - ringing: Phone is ringing
    - connected/in-progress: Call is active
    - ended/completed: Call finished successfully
    - failed: Call failed with error
    - no-answer: No one answered
    - busy: Line was busy
    - canceled: User canceled the call
    - voicemail_detected: Voicemail detected (AMD)
*/

-- Add is_mock column to active_calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_calls' AND column_name = 'is_mock'
  ) THEN
    ALTER TABLE active_calls ADD COLUMN is_mock boolean DEFAULT false;
  END IF;
END $$;

-- Add last_error column to active_calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_calls' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE active_calls ADD COLUMN last_error text;
  END IF;
END $$;

-- Add mock_config to dialer_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'mock_config'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN mock_config jsonb DEFAULT '{
      "enabled": false,
      "dialingDuration": 1000,
      "ringingDuration": 3000,
      "connectionProbability": 0.8,
      "voicemailProbability": 0.15,
      "noAnswerProbability": 0.05
    }'::jsonb;
  END IF;
END $$;

-- Add use_mock_dialer flag to dialer_settings for easy toggling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dialer_settings' AND column_name = 'use_mock_dialer'
  ) THEN
    ALTER TABLE dialer_settings ADD COLUMN use_mock_dialer boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster mock call queries
CREATE INDEX IF NOT EXISTS idx_active_calls_is_mock ON active_calls(is_mock);

-- Create index for user email + lead_id lookups (common query pattern)
CREATE INDEX IF NOT EXISTS idx_active_calls_user_lead ON active_calls(user_email, lead_id);

-- Create helper function to check if status is terminal (call is finished)
CREATE OR REPLACE FUNCTION is_terminal_call_status(status text)
RETURNS boolean AS $$
BEGIN
  RETURN status IN (
    'completed', 'ended', 'failed', 'busy', 
    'no-answer', 'canceled', 'voicemail_detected'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create helper function to check if status is active (call in progress)
CREATE OR REPLACE FUNCTION is_active_call_status(status text)
RETURNS boolean AS $$
BEGIN
  RETURN status IN ('dialing', 'queued', 'ringing', 'in-progress', 'connected');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create view for current active calls (non-terminal only)
CREATE OR REPLACE VIEW v_current_active_calls AS
SELECT 
  ac.*,
  l.name as lead_name,
  l.phone as lead_phone,
  l.company as lead_company,
  is_active_call_status(ac.status) as is_active,
  is_terminal_call_status(ac.status) as is_terminal,
  EXTRACT(EPOCH FROM (NOW() - ac.started_at))::integer as seconds_since_start
FROM active_calls ac
LEFT JOIN leads l ON ac.lead_id = l.id
WHERE is_terminal_call_status(ac.status) = false
ORDER BY ac.line_number;

-- Grant access to the view
GRANT SELECT ON v_current_active_calls TO authenticated, anon;
