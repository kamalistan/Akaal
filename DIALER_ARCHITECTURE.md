# Dialer System Architecture

## Core Principles

1. **Single Source of Truth**: `active_calls` table is the authoritative source for all active call states
2. **Real-time Synchronization**: All clients subscribe to `active_calls` changes via Supabase real-time
3. **Consistent Status Values**: Use standardized status values across frontend and backend
4. **Mock Mode Support**: All components respect `use_mock_dialer` setting from `dialer_settings`

## Database Schema

### active_calls (Primary Table)
```sql
- id: uuid
- user_email: text (user making the call)
- lead_id: uuid (nullable - null for manual dialing)
- call_sid: text (Twilio SID or mock ID)
- line_number: integer (1-3 for multi-line)
- status: text (dialing, ringing, in-progress, ended, etc.)
- status_source: text (mock, system, webhook, manual)
- is_mock: boolean (true for demo mode)
- last_error: text (error messages)
- started_at: timestamptz
- answered_at: timestamptz
- ended_at: timestamptz
```

### dialer_settings
```sql
- user_email: text
- use_mock_dialer: boolean (demo mode toggle)
- mock_config: jsonb (mock behavior settings)
- ... other settings
```

## Status Flow

### Status Values
- `idle`: No active call
- `dialing`: Call initiated, connecting
- `ringing`: Phone is ringing
- `in-progress` / `connected`: Call is active
- `ended` / `completed`: Call finished successfully
- `failed`: Call failed with error
- `no-answer`: No one answered
- `busy`: Line was busy
- `canceled`: User canceled
- `voicemail_detected`: AMD detected voicemail

### Status Transitions
```
idle → dialing → ringing → in-progress → ended
               ↓         ↓           ↓
            canceled   no-answer   failed
```

## Component Architecture

### PhoneDialer (Manual Number Entry)
- Used for: Dialing arbitrary phone numbers
- Lead context: None (leadId = null)
- Subscription: Monitors `active_calls` WHERE `lead_id IS NULL`
- Uses: `useDialerCallSubscription(userEmail)`

### DialerModal (Lead-based Calling)
- Used for: Calling specific leads from lists
- Lead context: Required (leadId = lead.id)
- Subscription: Monitors `active_calls` WHERE `lead_id = {leadId}`
- Uses: `useCallSubscription(userEmail, leadId)`

## Edge Functions

### twilioInitiateCall
- Parameters: `to`, `userEmail`, `leadId` (optional), `leadName`, `lineNumber`, `enableAMD`, `enableRecording`, `sessionId`
- Behavior: Makes real Twilio call
- Writes to: `active_calls` AND `twilio_call_logs`
- Requires: Twilio credentials in env

### mockDialerCall
- Parameters: `to`, `userEmail`, `leadId` (optional), `leadName`, `lineNumber`, `mockConfig`, `sessionId`
- Behavior: Simulates call with configurable timing
- Writes to: `active_calls` (with `is_mock: true`)
- Requires: No external credentials

### twilioEndCall
- Parameters: `callSid`, `userEmail`
- Behavior: Terminates Twilio call + updates database
- Updates: `active_calls` status to `completed`

## Real-time Subscription Pattern

```javascript
// Subscribe to active calls for specific context
supabase
  .channel(channelName)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'active_calls',
    filter: `user_email=eq.${userEmail}`
  }, handleCallUpdate)
  .subscribe()
```

## Mock Mode vs Real Mode

### Demo Mode (use_mock_dialer = true)
- Calls `mockDialerCall` edge function
- No Twilio credentials needed
- Simulates realistic call flow
- Sets `is_mock: true` in database
- Uses `status_source: 'mock'`

### Production Mode (use_mock_dialer = false)
- Calls `twilioInitiateCall` edge function
- Requires Twilio credentials
- Makes real phone calls
- Sets `is_mock: false` in database
- Uses `status_source: 'system'`

## Call History

### During Active Call
- Data stored in `active_calls` table
- Real-time updates via subscriptions
- Multiple clients can monitor same call

### After Call Ends
- Call outcome logged to `call_logs` table
- Lead status updated in `leads` table
- User stats updated in `user_stats` table
- `active_calls` record can be deleted or archived

## Error Handling

1. **Twilio Not Configured**: Show clear message with option to enable demo mode
2. **Network Errors**: Update `last_error` field, show to user
3. **Invalid Phone Numbers**: Validate before calling edge function
4. **Subscription Failures**: Fall back to polling if real-time fails

## Migration Path

OLD (Broken):
- PhoneDialer → dialer_call_history table → no real-time updates
- DialerModal → active_calls table → real-time updates
- Inconsistent data, different behaviors

NEW (Fixed):
- PhoneDialer → active_calls table (lead_id = null) → real-time updates
- DialerModal → active_calls table (lead_id = {id}) → real-time updates
- Consistent data, unified behavior
- `dialer_call_history` deprecated (not used)
