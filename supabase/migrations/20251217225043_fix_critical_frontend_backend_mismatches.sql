/*
  # Fix Critical Frontend/Backend Mismatches
  
  1. Changes
    - Standardize all timestamp fields to `created_at` (Postgres convention)
      - Rename `created_date` to `created_at` in: leads, call_logs, user_stats
    - Add `error_details` jsonb column to `ghl_sync_log` table
    - Enable realtime replication for `active_calls` table
  
  2. Impact
    - Frontend queries expecting `created_at` will now work correctly
    - GHL import can save detailed skip reasons
    - Call status updates will sync in real-time across all clients
  
  3. Data Safety
    - Uses IF EXISTS/IF NOT EXISTS to prevent errors
    - Preserves all existing data during column renames
    - No data deletion or loss
*/

-- 1. Standardize timestamp field names to created_at
DO $$
BEGIN
  -- Rename created_date to created_at in leads table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'created_date'
  ) THEN
    ALTER TABLE leads RENAME COLUMN created_date TO created_at;
  END IF;

  -- Rename created_date to created_at in call_logs table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'created_date'
  ) THEN
    ALTER TABLE call_logs RENAME COLUMN created_date TO created_at;
  END IF;

  -- Rename created_date to created_at in user_stats table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'created_date'
  ) THEN
    ALTER TABLE user_stats RENAME COLUMN created_date TO created_at;
  END IF;
END $$;

-- 2. Add error_details column to ghl_sync_log for storing detailed skip reasons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ghl_sync_log' AND column_name = 'error_details'
  ) THEN
    ALTER TABLE ghl_sync_log ADD COLUMN error_details jsonb;
  END IF;
END $$;

-- 3. Enable realtime replication for active_calls table
DO $$
BEGIN
  -- Check if active_calls table exists and isn't already in the publication
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'active_calls'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'active_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_calls;
  END IF;
END $$;