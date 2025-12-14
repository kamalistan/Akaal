/*
  # Create user_stats table

  1. New Tables
    - `user_stats`
      - `id` (uuid, primary key, auto-generated)
      - `user_email` (text, required, unique) - User's email identifier
      - `total_points` (integer, default: 0) - Total XP points earned
      - `level` (integer, default: 1) - Current level
      - `calls_today` (integer, default: 0) - Number of calls made today
      - `appointments_today` (integer, default: 0) - Number of appointments set today
      - `current_streak` (integer, default: 0) - Current consecutive days streak
      - `best_streak` (integer, default: 0) - Best streak achieved
      - `daily_goal` (integer, default: 50) - Daily call goal
      - `mascot_mood` (text, default: 'neutral') - Mascot emotional state
      - `created_date` (timestamptz, auto) - Record creation timestamp
      - `updated_date` (timestamptz, auto) - Last update timestamp

  2. Security
    - Enable RLS on `user_stats` table
    - Add policies for public access (suitable for demo/development)
*/

CREATE TABLE IF NOT EXISTS user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL UNIQUE,
  total_points integer DEFAULT 0,
  level integer DEFAULT 1,
  calls_today integer DEFAULT 0,
  appointments_today integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  daily_goal integer DEFAULT 50,
  mascot_mood text DEFAULT 'neutral',
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now()
);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user stats"
  ON user_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert user stats"
  ON user_stats
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update user stats"
  ON user_stats
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete user stats"
  ON user_stats
  FOR DELETE
  TO anon, authenticated
  USING (true);
