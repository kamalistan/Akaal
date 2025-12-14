/*
  # Create call_logs table

  1. New Tables
    - `call_logs`
      - `id` (uuid, primary key, auto-generated)
      - `lead_id` (uuid, foreign key to leads) - Reference to the lead called
      - `lead_name` (text, required) - Lead name snapshot
      - `duration` (integer, default: 0) - Call duration in seconds
      - `outcome` (text, required) - Call outcome (appointment_set, callback, not_interested, no_answer, voicemail, wrong_number)
      - `points_earned` (integer, default: 0) - Points earned from this call
      - `notes` (text, optional) - Call notes
      - `is_voicemail` (boolean, default: false) - Whether voicemail was left
      - `created_date` (timestamptz, auto) - Call timestamp

  2. Security
    - Enable RLS on `call_logs` table
    - Add policies for authenticated users to manage call logs
    - Add foreign key constraint to leads table

  3. Notes
    - Foreign key uses ON DELETE SET NULL to preserve call history even if lead is deleted
*/

CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  lead_name text NOT NULL,
  duration integer DEFAULT 0,
  outcome text NOT NULL,
  points_earned integer DEFAULT 0,
  notes text,
  is_voicemail boolean DEFAULT false,
  created_date timestamptz DEFAULT now(),
  CONSTRAINT fk_lead
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE SET NULL
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all call logs"
  ON call_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert call logs"
  ON call_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update call logs"
  ON call_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete call logs"
  ON call_logs
  FOR DELETE
  TO authenticated
  USING (true);
