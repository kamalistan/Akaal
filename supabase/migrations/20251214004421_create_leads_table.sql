/*
  # Create leads table

  1. New Tables
    - `leads`
      - `id` (uuid, primary key, auto-generated)
      - `name` (text, required) - Lead's full name
      - `phone` (text, required) - Contact phone number
      - `email` (text, optional) - Contact email address
      - `company` (text, optional) - Company name
      - `status` (text, default: 'new') - Lead status (new, contacted, interested, appointment_set, not_interested, no_answer)
      - `call_count` (integer, default: 0) - Number of times called
      - `last_called` (timestamptz, nullable) - Last call timestamp
      - `notes` (text, optional) - Notes about the lead
      - `created_date` (timestamptz, auto) - Record creation timestamp

  2. Security
    - Enable RLS on `leads` table
    - Add policies for authenticated users to manage leads
*/

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  company text,
  status text DEFAULT 'new',
  call_count integer DEFAULT 0,
  last_called timestamptz,
  notes text,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete leads"
  ON leads
  FOR DELETE
  TO authenticated
  USING (true);
