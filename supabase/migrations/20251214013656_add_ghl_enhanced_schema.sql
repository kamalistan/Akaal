/*
  # Add GoHighLevel Enhanced Schema

  ## Overview
  This migration enhances the database to support comprehensive GoHighLevel integration,
  including opportunities, pipelines, custom fields, and sync tracking.

  ## 1. Enhance Leads Table
  Add GHL-specific columns to track integration data:
    - `ghl_contact_id` - GoHighLevel contact reference ID
    - `ghl_opportunity_id` - GoHighLevel opportunity reference ID
    - `pipeline_id` - Current pipeline ID
    - `pipeline_stage_id` - Current stage within pipeline
    - `opportunity_value` - Monetary value of the opportunity
    - `opportunity_status` - Status (open, won, lost, abandoned)
    - `source` - Lead source/origin
    - `tags` - JSONB array of tags
    - `assigned_user_id` - GHL user assigned to this lead
    - `custom_fields` - JSONB storage for custom field values
    - `last_synced_at` - Timestamp of last GHL sync

  ## 2. New Tables

  ### ghl_pipelines
  Stores pipeline configurations from GoHighLevel
    - `id` (uuid, primary key)
    - `ghl_pipeline_id` (text, unique) - External GHL pipeline ID
    - `name` (text) - Pipeline name
    - `stages` (jsonb) - Array of stage objects
    - `location_id` (text) - GHL location ID
    - `is_active` (boolean) - Whether to sync this pipeline
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### ghl_sync_log
  Tracks import and sync operations
    - `id` (uuid, primary key)
    - `sync_type` (text) - Type of sync (full_import, refresh, etc.)
    - `pipeline_id` (uuid) - Reference to pipeline
    - `status` (text) - Status (in_progress, completed, failed)
    - `records_processed` (integer) - Number of records processed
    - `records_imported` (integer) - Number of new records
    - `records_updated` (integer) - Number of updated records
    - `records_skipped` (integer) - Number of skipped records
    - `error_message` (text) - Error details if failed
    - `started_at` (timestamptz)
    - `completed_at` (timestamptz)

  ## 3. Security
  - Enable RLS on all new tables
  - Add policies for public access (suitable for demo/development)
  - Maintain existing security model

  ## 4. Indexes
  Add indexes for performance on frequently queried columns
*/

-- Add GHL-specific columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ghl_contact_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ghl_opportunity_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS opportunity_value decimal(10, 2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS opportunity_status text DEFAULT 'open';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_user_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Create indexes on leads table for GHL fields
CREATE INDEX IF NOT EXISTS idx_leads_ghl_contact_id ON leads(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_ghl_opportunity_id ON leads(ghl_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_id ON leads(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage_id ON leads(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_opportunity_status ON leads(opportunity_status);

-- Create ghl_pipelines table
CREATE TABLE IF NOT EXISTS ghl_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_pipeline_id text UNIQUE NOT NULL,
  name text NOT NULL,
  stages jsonb DEFAULT '[]'::jsonb,
  location_id text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ghl_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pipelines"
  ON ghl_pipelines
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert pipelines"
  ON ghl_pipelines
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update pipelines"
  ON ghl_pipelines
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete pipelines"
  ON ghl_pipelines
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create index on ghl_pipeline_id
CREATE INDEX IF NOT EXISTS idx_ghl_pipelines_ghl_pipeline_id ON ghl_pipelines(ghl_pipeline_id);

-- Create ghl_sync_log table
CREATE TABLE IF NOT EXISTS ghl_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  pipeline_id uuid REFERENCES ghl_pipelines(id) ON DELETE SET NULL,
  status text DEFAULT 'in_progress',
  records_processed integer DEFAULT 0,
  records_imported integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE ghl_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sync logs"
  ON ghl_sync_log
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert sync logs"
  ON ghl_sync_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update sync logs"
  ON ghl_sync_log
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Add foreign key constraint from leads to ghl_pipelines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leads_pipeline'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT fk_leads_pipeline
      FOREIGN KEY (pipeline_id)
      REFERENCES ghl_pipelines(id)
      ON DELETE SET NULL;
  END IF;
END $$;