/*
  # Create assignments table

  1. New Tables
    - `assignments`
      - `id` (uuid, primary key, auto-generated)
      - `title` (text, required) - Assignment title
      - `type` (text, default: 'worksheet') - Assignment type (worksheet, essay)
      - `status` (text, default: 'not_started') - Status (not_started, in_progress, completed)
      - `youtube_videos` (jsonb, default: []) - Array of YouTube video URLs/data
      - `readings` (jsonb, default: []) - Array of reading materials
      - `due_date` (date, optional) - Assignment due date
      - `created_date` (timestamptz, auto) - Record creation timestamp

  2. Security
    - Enable RLS on `assignments` table
    - Add policies for authenticated users to manage assignments

  3. Notes
    - Uses JSONB for flexible storage of video and reading data arrays
    - Supports the Music Homework feature
*/

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text DEFAULT 'worksheet',
  status text DEFAULT 'not_started',
  youtube_videos jsonb DEFAULT '[]'::jsonb,
  readings jsonb DEFAULT '[]'::jsonb,
  due_date date,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all assignments"
  ON assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert assignments"
  ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignments"
  ON assignments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete assignments"
  ON assignments
  FOR DELETE
  TO authenticated
  USING (true);
