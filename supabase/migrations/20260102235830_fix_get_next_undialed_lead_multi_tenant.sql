/*
  # Fix get_next_undialed_lead for Multi-Tenancy

  ## Overview
  Updates the get_next_undialed_lead function to properly filter by user_email
  to ensure users only get their own leads.

  ## Changes
    - Add user_email parameter to function
    - Filter leads by user_email in WHERE clause
    - Ensure proper multi-tenant isolation
*/

-- Drop existing function
DROP FUNCTION IF EXISTS get_next_undialed_lead(uuid, uuid);

-- Recreate with user_email parameter
CREATE OR REPLACE FUNCTION get_next_undialed_lead(
  p_session_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_user_email text DEFAULT 'demo@example.com'
)
RETURNS TABLE (
  lead_id uuid,
  name text,
  phone text,
  email text,
  company text,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.phone,
    l.email,
    l.company,
    l.status
  FROM leads l
  WHERE 
    l.user_email = p_user_email
    AND (p_pipeline_id IS NULL OR l.pipeline_id = p_pipeline_id)
    AND l.is_dnc = false
    AND l.id NOT IN (
      SELECT lead_id 
      FROM session_lead_attempts 
      WHERE session_id = p_session_id
    )
  ORDER BY 
    l.last_called_at NULLS FIRST,
    l.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_next_undialed_lead TO authenticated, anon;
