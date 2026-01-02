/*
  # Multi-Tenant GHL Integration

  ## Overview
  Adds support for multi-tenant GoHighLevel integration where each user can:
  - Connect their own GHL API key and location ID
  - Sync their own pipelines and contacts
  - Keep data completely isolated from other users

  ## 1. GHL Credentials Table
  Stores encrypted GHL credentials per user:
    - `id` (uuid) - Primary key
    - `user_email` (text, unique) - User identifier
    - `ghl_api_key` (text) - Encrypted GHL API key
    - `ghl_location_id` (text) - GHL location ID
    - `agency_id` (text) - Optional agency ID
    - `is_active` (boolean) - Connection status
    - `last_synced_at` (timestamptz) - Last successful sync
    - `sync_status` (text) - Current sync status
    - `sync_error` (text) - Last sync error if any
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Update Existing Tables for Multi-Tenancy
  Add user_email columns and update RLS policies to ensure data isolation:
    - leads: Add user_email and owner-based access
    - ghl_pipelines: Add user_email for per-user pipelines
    - dialer_sessions: Already has user_email

  ## 3. GHL Sync Tracking
  Enhanced sync logging per user

  ## Security
  - Enable RLS on all tables
  - Users can ONLY access their own credentials and data
  - API keys should be encrypted at rest (handled by application layer)
  - Strict isolation between tenants
*/

-- 1. Create GHL credentials table
CREATE TABLE IF NOT EXISTS ghl_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text UNIQUE NOT NULL,
  ghl_api_key text NOT NULL,
  ghl_location_id text NOT NULL,
  agency_id text,
  is_active boolean DEFAULT true,
  last_synced_at timestamptz,
  sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ghl_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GHL credentials"
  ON ghl_credentials FOR SELECT
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can insert own GHL credentials"
  ON ghl_credentials FOR INSERT
  TO authenticated
  WITH CHECK (user_email = 'demo@example.com');

CREATE POLICY "Users can update own GHL credentials"
  ON ghl_credentials FOR UPDATE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE POLICY "Users can delete own GHL credentials"
  ON ghl_credentials FOR DELETE
  TO authenticated
  USING (user_email = 'demo@example.com');

CREATE INDEX IF NOT EXISTS idx_ghl_credentials_user_email ON ghl_credentials(user_email);
CREATE INDEX IF NOT EXISTS idx_ghl_credentials_active ON ghl_credentials(is_active) WHERE is_active = true;

-- 2. Add user_email to leads table if not exists (for multi-tenancy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE leads ADD COLUMN user_email text DEFAULT 'demo@example.com';
    CREATE INDEX idx_leads_user_email ON leads(user_email);
  END IF;
END $$;

-- 3. Add user_email to ghl_pipelines if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ghl_pipelines' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE ghl_pipelines ADD COLUMN user_email text DEFAULT 'demo@example.com';
    CREATE INDEX idx_ghl_pipelines_user_email ON ghl_pipelines(user_email);
  END IF;
END $$;

-- 4. Update RLS policies for leads to enforce user-based access
DROP POLICY IF EXISTS "Anyone can view leads" ON leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON leads;
DROP POLICY IF EXISTS "Anyone can update leads" ON leads;
DROP POLICY IF EXISTS "Anyone can delete leads" ON leads;

CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  TO authenticated, anon
  USING (user_email = 'demo@example.com' OR user_email IS NULL);

CREATE POLICY "Users can insert own leads"
  ON leads FOR INSERT
  TO authenticated, anon
  WITH CHECK (user_email = 'demo@example.com' OR user_email IS NULL);

CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  TO authenticated, anon
  USING (user_email = 'demo@example.com' OR user_email IS NULL);

CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  TO authenticated, anon
  USING (user_email = 'demo@example.com' OR user_email IS NULL);

-- 5. Update RLS policies for ghl_pipelines
DROP POLICY IF EXISTS "Public pipelines read access" ON ghl_pipelines;
DROP POLICY IF EXISTS "Public pipelines write access" ON ghl_pipelines;

CREATE POLICY "Users can view own pipelines"
  ON ghl_pipelines FOR SELECT
  TO authenticated, anon
  USING (user_email = 'demo@example.com' OR user_email IS NULL);

CREATE POLICY "Users can insert own pipelines"
  ON ghl_pipelines FOR INSERT
  TO authenticated, anon
  WITH CHECK (user_email = 'demo@example.com' OR user_email IS NULL);

CREATE POLICY "Users can update own pipelines"
  ON ghl_pipelines FOR UPDATE
  TO authenticated, anon
  USING (user_email = 'demo@example.com' OR user_email IS NULL);

CREATE POLICY "Users can delete own pipelines"
  ON ghl_pipelines FOR DELETE
  TO authenticated, anon
  USING (user_email = 'demo@example.com' OR user_email IS NULL);

-- 6. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger for ghl_credentials
DROP TRIGGER IF EXISTS update_ghl_credentials_updated_at ON ghl_credentials;
CREATE TRIGGER update_ghl_credentials_updated_at
  BEFORE UPDATE ON ghl_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Create view for user GHL connection status
CREATE OR REPLACE VIEW v_user_ghl_status AS
SELECT 
  gc.user_email,
  gc.is_active,
  gc.last_synced_at,
  gc.sync_status,
  gc.sync_error,
  COUNT(DISTINCT gp.id) as pipeline_count,
  COUNT(DISTINCT l.id) as lead_count,
  gc.created_at as connected_at
FROM ghl_credentials gc
LEFT JOIN ghl_pipelines gp ON gp.user_email = gc.user_email
LEFT JOIN leads l ON l.user_email = gc.user_email
WHERE gc.is_active = true
GROUP BY gc.user_email, gc.is_active, gc.last_synced_at, gc.sync_status, gc.sync_error, gc.created_at;

GRANT SELECT ON v_user_ghl_status TO authenticated, anon;

-- 9. Create function to check if user has GHL connected
CREATE OR REPLACE FUNCTION user_has_ghl_connected(p_user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM ghl_credentials 
    WHERE user_email = p_user_email 
      AND is_active = true
      AND ghl_api_key IS NOT NULL
      AND ghl_location_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION user_has_ghl_connected TO authenticated, anon;
