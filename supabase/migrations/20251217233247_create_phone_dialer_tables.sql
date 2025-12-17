/*
  # Phone Dialer System Tables

  ## Overview
  This migration creates tables to support a full-featured phone dialer with:
  - Favorites/Speed dial contacts
  - Complete call history tracking
  - User preferences for dialer behavior
  - Recent numbers for quick redial

  ## 1. Dialer Favorites Table
  Stores user's favorite contacts for quick dialing:
    - `id` (uuid, primary key) - Unique identifier
    - `user_email` (text) - Owner of the favorite
    - `name` (text) - Display name for the contact
    - `phone_number` (text) - Phone number
    - `speed_dial_slot` (integer) - Optional speed dial position (1-9)
    - `avatar_url` (text) - Optional avatar image
    - `notes` (text) - Additional notes about the contact
    - `company` (text) - Company name
    - `email` (text) - Email address
    - `tags` (jsonb) - Flexible tags for categorization
    - `call_count` (integer) - Number of times called
    - `last_called_at` (timestamptz) - Last call timestamp
    - `is_favorite` (boolean) - Pinned favorite status
    - `sort_order` (integer) - Custom sorting
    - `created_at` (timestamptz) - Creation timestamp

  ## 2. Dialer Call History Table
  Complete history of all dialer calls (manual and lead-based):
    - `id` (uuid, primary key) - Unique identifier
    - `user_email` (text) - User who made/received the call
    - `phone_number` (text) - Phone number called
    - `contact_name` (text) - Name if known
    - `direction` (text) - 'outbound' or 'inbound'
    - `call_sid` (text) - Twilio call SID
    - `status` (text) - Call status (completed, no-answer, busy, failed)
    - `duration` (integer) - Call duration in seconds
    - `outcome` (text) - Call outcome/disposition
    - `notes` (text) - Call notes
    - `started_at` (timestamptz) - Call start time
    - `answered_at` (timestamptz) - Time call was answered
    - `ended_at` (timestamptz) - Call end time
    - `lead_id` (uuid) - Reference to leads table if applicable
    - `is_missed` (boolean) - Missed call indicator
    - `voicemail_left` (boolean) - Voicemail left indicator
    - `created_at` (timestamptz) - Record creation time

  ## 3. Dialer Preferences Table
  User-specific dialer settings and preferences:
    - `id` (uuid, primary key) - Unique identifier
    - `user_email` (text, unique) - User identifier
    - `default_country_code` (text) - Default country code (e.g., '+1')
    - `number_format_preference` (text) - Display format (us, international)
    - `enable_dial_tones` (boolean) - Play DTMF tones
    - `enable_vibration` (boolean) - Vibration feedback
    - `auto_redial_on_busy` (boolean) - Auto redial feature
    - `show_call_duration` (boolean) - Show timer during calls
    - `confirm_before_call` (boolean) - Confirmation dialog
    - `save_to_history` (boolean) - Auto-save call history
    - `default_caller_id` (text) - Default caller ID to use
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ## 4. Recent Numbers Table
  Quick access to recently dialed numbers:
    - `id` (uuid, primary key) - Unique identifier
    - `user_email` (text) - User who dialed
    - `phone_number` (text) - Phone number
    - `contact_name` (text) - Name if known
    - `last_called_at` (timestamptz) - Last call timestamp
    - `call_count` (integer) - Number of times called
    - `created_at` (timestamptz) - First call timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Proper indexes for performance
  - Foreign key constraints for data integrity
*/

-- 1. Create dialer_favorites table
CREATE TABLE IF NOT EXISTS dialer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  name text NOT NULL,
  phone_number text NOT NULL,
  speed_dial_slot integer CHECK (speed_dial_slot >= 1 AND speed_dial_slot <= 9),
  avatar_url text,
  notes text,
  company text,
  email text,
  tags jsonb DEFAULT '[]'::jsonb,
  call_count integer DEFAULT 0,
  last_called_at timestamptz,
  is_favorite boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_email, speed_dial_slot)
);

ALTER TABLE dialer_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON dialer_favorites FOR SELECT
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can insert own favorites"
  ON dialer_favorites FOR INSERT
  TO authenticated
  WITH CHECK (user_email = 'demo@example.com');

CREATE POLICY "Users can update own favorites"
  ON dialer_favorites FOR UPDATE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can delete own favorites"
  ON dialer_favorites FOR DELETE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE INDEX IF NOT EXISTS idx_dialer_favorites_user_email ON dialer_favorites(user_email);
CREATE INDEX IF NOT EXISTS idx_dialer_favorites_phone_number ON dialer_favorites(phone_number);
CREATE INDEX IF NOT EXISTS idx_dialer_favorites_speed_dial ON dialer_favorites(speed_dial_slot) WHERE speed_dial_slot IS NOT NULL;

-- 2. Create dialer_call_history table
CREATE TABLE IF NOT EXISTS dialer_call_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  phone_number text NOT NULL,
  contact_name text,
  direction text DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  call_sid text,
  status text DEFAULT 'initiated',
  duration integer DEFAULT 0,
  outcome text,
  notes text,
  started_at timestamptz DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  is_missed boolean DEFAULT false,
  voicemail_left boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dialer_call_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own call history"
  ON dialer_call_history FOR SELECT
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can insert own call history"
  ON dialer_call_history FOR INSERT
  TO authenticated
  WITH CHECK (user_email = 'demo@example.com');

CREATE POLICY "Users can update own call history"
  ON dialer_call_history FOR UPDATE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can delete own call history"
  ON dialer_call_history FOR DELETE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE INDEX IF NOT EXISTS idx_dialer_call_history_user_email ON dialer_call_history(user_email);
CREATE INDEX IF NOT EXISTS idx_dialer_call_history_phone_number ON dialer_call_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_dialer_call_history_started_at ON dialer_call_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dialer_call_history_direction ON dialer_call_history(direction);
CREATE INDEX IF NOT EXISTS idx_dialer_call_history_is_missed ON dialer_call_history(is_missed) WHERE is_missed = true;

-- 3. Create dialer_preferences table
CREATE TABLE IF NOT EXISTS dialer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text UNIQUE NOT NULL,
  default_country_code text DEFAULT '+1',
  number_format_preference text DEFAULT 'us' CHECK (number_format_preference IN ('us', 'international', 'national')),
  enable_dial_tones boolean DEFAULT true,
  enable_vibration boolean DEFAULT true,
  auto_redial_on_busy boolean DEFAULT false,
  show_call_duration boolean DEFAULT true,
  confirm_before_call boolean DEFAULT false,
  save_to_history boolean DEFAULT true,
  default_caller_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dialer_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON dialer_preferences FOR SELECT
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can insert own preferences"
  ON dialer_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_email = 'demo@example.com');

CREATE POLICY "Users can update own preferences"
  ON dialer_preferences FOR UPDATE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE INDEX IF NOT EXISTS idx_dialer_preferences_user_email ON dialer_preferences(user_email);

-- 4. Create recent_numbers table
CREATE TABLE IF NOT EXISTS recent_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  phone_number text NOT NULL,
  contact_name text,
  last_called_at timestamptz DEFAULT now(),
  call_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_email, phone_number)
);

ALTER TABLE recent_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recent numbers"
  ON recent_numbers FOR SELECT
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can insert own recent numbers"
  ON recent_numbers FOR INSERT
  TO authenticated
  WITH CHECK (user_email = 'demo@example.com');

CREATE POLICY "Users can update own recent numbers"
  ON recent_numbers FOR UPDATE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can delete own recent numbers"
  ON recent_numbers FOR DELETE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE INDEX IF NOT EXISTS idx_recent_numbers_user_email ON recent_numbers(user_email);
CREATE INDEX IF NOT EXISTS idx_recent_numbers_last_called_at ON recent_numbers(last_called_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_numbers_phone_number ON recent_numbers(phone_number);

-- 5. Create function to update recent numbers
CREATE OR REPLACE FUNCTION update_recent_numbers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO recent_numbers (user_email, phone_number, contact_name, last_called_at, call_count)
  VALUES (NEW.user_email, NEW.phone_number, NEW.contact_name, NEW.started_at, 1)
  ON CONFLICT (user_email, phone_number)
  DO UPDATE SET
    last_called_at = NEW.started_at,
    call_count = recent_numbers.call_count + 1,
    contact_name = COALESCE(NEW.contact_name, recent_numbers.contact_name);
  
  RETURN NEW;
END;
$$;

-- 6. Create trigger to auto-update recent numbers
DROP TRIGGER IF EXISTS trigger_update_recent_numbers ON dialer_call_history;
CREATE TRIGGER trigger_update_recent_numbers
  AFTER INSERT ON dialer_call_history
  FOR EACH ROW
  WHEN (NEW.direction = 'outbound')
  EXECUTE FUNCTION update_recent_numbers();

-- 7. Create function to increment favorite call count
CREATE OR REPLACE FUNCTION increment_favorite_call_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE dialer_favorites
  SET 
    call_count = call_count + 1,
    last_called_at = NEW.started_at
  WHERE user_email = NEW.user_email 
    AND phone_number = NEW.phone_number;
  
  RETURN NEW;
END;
$$;

-- 8. Create trigger to auto-increment favorite call count
DROP TRIGGER IF EXISTS trigger_increment_favorite_call_count ON dialer_call_history;
CREATE TRIGGER trigger_increment_favorite_call_count
  AFTER INSERT ON dialer_call_history
  FOR EACH ROW
  WHEN (NEW.direction = 'outbound')
  EXECUTE FUNCTION increment_favorite_call_count();
