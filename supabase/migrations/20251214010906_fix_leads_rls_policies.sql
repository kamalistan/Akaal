/*
  # Fix leads table RLS policies for unauthenticated access

  1. Changes
    - Drop existing authenticated-only policies
    - Add new policies that allow public (anon) access to leads table
    - This enables the app to work without requiring actual Supabase authentication

  2. Security
    - Policies now allow anon role to perform all operations on leads
    - Suitable for demo/development environments
*/

DROP POLICY IF EXISTS "Authenticated users can view all leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON leads;

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
