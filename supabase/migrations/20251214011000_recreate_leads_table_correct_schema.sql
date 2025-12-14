/*
  # Recreate leads table with correct schema

  1. Changes
    - Drop existing leads table with incorrect schema
    - Create leads table with correct columns and uuid primary key
    - Enable RLS with public access policies

  2. Security
    - Policies allow anon and authenticated users full access
    - Suitable for demo/development environments
*/

DROP TABLE IF EXISTS leads CASCADE;

CREATE TABLE leads (
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

CREATE POLICY "Anyone can view leads"
  ON leads
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert leads"
  ON leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update leads"
  ON leads
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete leads"
  ON leads
  FOR DELETE
  TO anon, authenticated
  USING (true);
