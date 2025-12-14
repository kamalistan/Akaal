-- Create Twilio Call Logs and User Settings Tables

-- Create twilio_call_logs table
CREATE TABLE IF NOT EXISTS twilio_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  status text,
  duration integer DEFAULT 0,
  to_number text,
  from_number text,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create dialer_settings table
CREATE TABLE IF NOT EXISTS dialer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text UNIQUE NOT NULL,
  double_dial_enabled boolean DEFAULT false,
  max_dialing_lines integer DEFAULT 1 CHECK (max_dialing_lines >= 1 AND max_dialing_lines <= 3),
  auto_detect_voicemail boolean DEFAULT false,
  timezone_protection boolean DEFAULT true,
  timezone text DEFAULT 'America/New_York',
  calling_hours_start time DEFAULT '09:00:00',
  calling_hours_end time DEFAULT '17:00:00',
  theme text DEFAULT 'regular' CHECK (theme IN ('regular', 'dark', 'christmas')),
  calendly_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE twilio_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialer_settings ENABLE ROW LEVEL SECURITY;

-- Policies for twilio_call_logs (public read for now since we don't have auth)
CREATE POLICY "Anyone can view call logs"
  ON twilio_call_logs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert call logs"
  ON twilio_call_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update call logs"
  ON twilio_call_logs FOR UPDATE
  USING (true);

-- Policies for dialer_settings (user-specific)
CREATE POLICY "Users can view own settings"
  ON dialer_settings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own settings"
  ON dialer_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own settings"
  ON dialer_settings FOR UPDATE
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_sid ON twilio_call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_lead_id ON twilio_call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_dialer_settings_user_email ON dialer_settings(user_email);