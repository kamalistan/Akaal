/*
  # Add 'mock' to status_source constraint

  1. Changes
    - Update check constraint on call_status_history to allow 'mock' as a valid status_source
    - This enables the mock dialer to properly log status changes
    
  2. Why
    - The mock dialer uses 'mock' as the status_source to differentiate demo calls from real calls
    - The existing constraint only allowed: 'webhook', 'manual', 'timeout', 'system', 'error'
*/

-- Drop the existing constraint
ALTER TABLE call_status_history 
DROP CONSTRAINT IF EXISTS call_status_history_status_source_check;

-- Add the updated constraint with 'mock' included
ALTER TABLE call_status_history
ADD CONSTRAINT call_status_history_status_source_check
CHECK (status_source IN ('webhook', 'manual', 'timeout', 'system', 'error', 'mock'));
