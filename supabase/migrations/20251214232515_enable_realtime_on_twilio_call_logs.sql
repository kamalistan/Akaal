/*
  # Enable Real-time Replication on Twilio Call Logs

  1. Changes
    - Enable real-time replication on twilio_call_logs table
    - This allows the frontend to subscribe to call status updates in real-time

  2. Security
    - Real-time subscriptions respect existing RLS policies
*/

ALTER PUBLICATION supabase_realtime ADD TABLE twilio_call_logs;
