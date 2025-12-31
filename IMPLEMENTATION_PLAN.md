# Feature Implementation Plan

## Existing Schema Analysis

### Tables We Can Use:
- ✅ `dialer_sessions` - Resume dialing functionality
- ✅ `dialer_call_history` - Call outcome tracking, metrics
- ✅ `call_recordings` - Recording storage
- ✅ `dialer_settings` - Enable recording toggle
- ✅ `leads` - Lead tracking with `last_called_at`, `call_count`

---

## Feature 1: Resume Dialing From Where User Left Off

### Implementation Approach (SIMPLEST)
- Use existing `dialer_sessions` table
- Track `current_lead_index` and `current_lead_id`
- On page load, check for active session and resume
- Mark leads as "attempted" after call attempt

### Database Schema
**Already exists! Using `dialer_sessions`:**
- `user_email` - Session owner
- `pipeline_id` - Which pipeline being dialed
- `current_lead_index` - Current position in list
- `current_lead_id` - Current lead UUID
- `total_leads` - Total in queue
- `completed_leads` - Number completed
- `is_active` - Session status
- `last_activity_at` - For timeout detection

**Add new table `session_lead_attempts`:**
```sql
CREATE TABLE session_lead_attempts (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES dialer_sessions(id),
  lead_id uuid REFERENCES leads(id),
  attempted_at timestamptz,
  outcome text, -- connected, no-answer, busy, voicemail, skipped
  UNIQUE(session_id, lead_id)
);
```

### API Endpoints
- `GET /api/sessions/active` - Get or create active session
- `POST /api/sessions/resume` - Resume from last position
- `POST /api/sessions/mark-attempted` - Mark lead as attempted
- `GET /api/sessions/next-lead` - Get next undialed lead

### Frontend vs Backend
- **Backend Source of Truth:**
  - Which leads have been attempted
  - Current position in lead list
  - Session active/inactive state
- **Frontend State:**
  - Current lead being displayed
  - UI for navigating leads
  - Progress visualization

---

## Feature 2: Manual Call Outcome Tracking

### Implementation Approach (SIMPLEST)
- Post-call modal with disposition buttons
- Store in `dialer_call_history.outcome` field
- Simple predefined outcomes (no custom dispositions initially)

### Database Schema
**Already exists! Using `dialer_call_history.outcome`**

Standard outcomes:
- `connected` - Spoke to decision maker
- `voicemail` - Left voicemail
- `no-answer` - No one answered
- `busy` - Line busy
- `callback` - Requested callback
- `not-interested` - Declined
- `wrong-number` - Invalid contact
- `dnc` - Do not call

### API Endpoints
- `POST /api/calls/disposition` - Save call outcome

### Frontend vs Backend
- **Backend Source of Truth:**
  - Call outcomes
  - Call duration
  - Timestamps (started_at, answered_at, ended_at)
- **Frontend State:**
  - Modal visibility
  - Selected disposition (before saving)

---

## Feature 3: Basic Metrics Tracking

### Implementation Approach (SIMPLEST)
- Query `dialer_call_history` for metrics
- Calculate on-demand (no pre-aggregation initially)
- Cache results per session

### Database Schema
**Already exists! Query from `dialer_call_history`:**
- `duration` - Talk time
- `outcome` - Success vs failure
- `started_at`, `ended_at` - For time-based queries
- `user_email` - Per-user metrics

**Add indexes for performance:**
```sql
CREATE INDEX idx_call_history_user_date ON dialer_call_history(user_email, started_at);
CREATE INDEX idx_call_history_outcome ON dialer_call_history(outcome);
```

### API Endpoints
- `GET /api/metrics/session/:sessionId` - Session metrics
- `GET /api/metrics/user/today` - Today's metrics
- `GET /api/metrics/user/summary` - Overall summary

### Metrics to Track
1. **Calls Made** - COUNT(*)
2. **Pickups** - COUNT WHERE outcome IN ('connected', 'voicemail')
3. **Talk Time** - SUM(duration WHERE answered_at IS NOT NULL)
4. **Success Rate** - (connected / total) * 100
5. **Average Call Duration** - AVG(duration)
6. **Conversion Rate** - (connected / pickups) * 100

### Frontend vs Backend
- **Backend Source of Truth:**
  - All raw call data
  - Calculated metrics
- **Frontend State:**
  - Displayed metrics
  - Refresh interval

---

## Feature 4: Call Recording (Toggleable)

### Implementation Approach (SIMPLEST)
- Read `enable_call_recording` from `dialer_settings`
- Pass to Twilio when initiating call
- Store recording URL in `call_recordings` table
- Link recording to call via `call_log_id`

### Database Schema
**Already exists! Using `call_recordings`:**
- `recording_sid` - Twilio recording ID
- `recording_url` - Public URL
- `duration` - Recording duration
- `call_log_id` - Link to call history
- `lead_id` - Link to lead
- `user_email` - Owner

### API Endpoints
- `GET /api/recordings/:callSid` - Get recording for call
- `GET /api/recordings/lead/:leadId` - All recordings for lead
- Twilio webhook receives recording callback (already implemented)

### Twilio Integration
**In `twilioInitiateCall` function:**
- Check `dialer_settings.enable_call_recording`
- Add `Record: 'record-from-answer'` to Twilio call params
- Add `RecordingStatusCallback` URL

**In `twilioCallStatus` webhook:**
- Receive `RecordingSid` and `RecordingUrl`
- Store in `call_recordings` table

### Frontend vs Backend
- **Backend Source of Truth:**
  - Recording enable/disable setting
  - Recording URLs
  - Recording metadata
- **Frontend State:**
  - Toggle button state
  - Audio player state

---

## Implementation Priority

1. ✅ Feature 1: Resume Dialing (30 min)
2. ✅ Feature 2: Call Outcome Tracking (20 min)
3. ✅ Feature 3: Metrics Tracking (25 min)
4. ✅ Feature 4: Call Recording (15 min)

**Total Estimated Time: ~90 minutes**

---

## Risk Mitigation

### Low-Risk Decisions:
- Using existing tables (no schema changes)
- Simple queries (no complex joins initially)
- Predefined outcomes (no custom fields)
- On-demand metrics (no background jobs)

### What We're Avoiding:
- ❌ AI/ML features
- ❌ Complex voicemail detection logic
- ❌ Live call transfer
- ❌ Real-time analytics dashboards
- ❌ Custom disposition builders
- ❌ Recording transcription (initially)

