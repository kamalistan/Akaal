/*
  # Fix get_next_undialed_lead Return Columns

  ## Overview
  Updates the function to return column names that match what the frontend expects.

  ## Changes
    - Return `lead_id` instead of `id`
    - Keep other column names consistent with frontend expectations
*/

-- Drop existing function
DROP FUNCTION IF EXISTS get_next_undialed_lead(uuid, uuid, text);

-- Recreate with correct return column names
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
    l.id as lead_id,
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
