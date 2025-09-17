# Critical Systems & Dependencies

This file documents critical systems that require careful consideration before modification. Changes to these systems can have widespread downstream impacts.

## 🕐 Timestamp System

**Status**: Recently fixed (Jan 2025) - DO NOT TOUCH without consultation
**Impact Level**: HIGH - Affects all user history, CSV exports, and time displays

### Current Implementation
- **Database**: SQLite stores `CURRENT_TIMESTAMP` as UTC naive strings: `"2025-01-17 14:30:45"`
- **parseTS()**: Treats naive timestamps as UTC by appending "Z": `new Date(ts.replace(" ", "T") + "Z")`
- **formatTimestamp()**: Uses parseTS() to properly convert UTC to local time for display

### Why This Works
1. SQLite CURRENT_TIMESTAMP = UTC time in naive format
2. parseTS() converts naive string to proper UTC Date object
3. toLocaleString() displays in user's local timezone
4. Result: User sees their local time correctly

### What Would Break
- Changing parseTS() to treat naive timestamps as local time would show incorrect times
- Using new Date() directly on SQLite timestamps would cause timezone offset errors
- History entries would show wrong times to users

### Dependencies
- All history displays (My History modal)
- CSV exports
- Undo functionality time checks
- Any time-based UI elements

### Functions Involved
- `parseTS()` in app.js:363-374
- `formatTimestamp()` in app.js:1451-1465
- `window.formatTimestamp()` in app.js:1691-1705
- Paint function timestamp display in app.js:553-561

---

## 💰 Balance Calculation System

**Status**: Core functionality - EXTREME CAUTION REQUIRED
**Impact Level**: CRITICAL - Core app functionality

### Current Implementation
- Real-time calculation by summing delta values: `history.reduce((s, r) => s + (r.delta || 0), 0)`
- Delta-based system (+1/-1 for deposits/withdrawals)
- Visual wallet thresholds (1, 5, 10, 15+ dollars change wallet image)
- No caching - calculated on every request

### Critical Functions
- `/functions/impulse-api/state.js:87-88` - Server-side balance calculation
- `/ui-pages/public/app.js:1367, 424, 434` - Frontend balance calculations
- `/ui-pages/public/app.js:2017-2020` - Wallet visual thresholds

### What Would Break
- **Data corruption**: Modifying delta logic corrupts all historical balances
- **Inconsistent states**: Frontend/backend balance calculations diverging
- **Visual glitches**: Balance thresholds affect wallet imagery
- **Performance issues**: Balance calculated by summing all entries on every request

### Dependencies
- `entries` table structure (room_code, player_uuid, delta, created_at)
- User membership validation in `players` table
- Weekly filtering logic using `getWeekStartLocal()` and `isInCurrentWeek()`
- Room state synchronization
- Leaderboard calculations
- Undo functionality (15-minute window)

### Modification Rules
- **NEVER** modify without comprehensive testing and data migration plan
- Consider implementing balance caching before any changes
- Test all visual wallet states and thresholds

---

## 🏠 Room Management System

**Status**: Complex flow with multiple validation layers
**Impact Level**: HIGH - User access and data isolation

### Current Implementation
- Room creation with auto-generated codes
- Invite-only system with private codes
- Creator permissions and management

### Critical Logic
- Join flow requires invite codes (recently fixed)
- Room code validation and uniqueness
- Permission-based features (room settings)

### Dependencies
- User authentication flow
- Permission system
- Data isolation between rooms

---

## 📅 Weekly Reset Functionality

**Status**: Complex timezone handling - HIGH CAUTION REQUIRED
**Impact Level**: HIGH - Affects focus areas and statistics

### Current Implementation
- Monday-based week calculation with client-side timezone handling
- Weekly focus area constraints (2-3 areas, locked once set)
- Weekly statistics filtering using `isInCurrentWeek()`

### Critical Functions
- `/ui-pages/public/app.js:376-387` - `getWeekStartLocal()` and `isInCurrentWeek()`
- `/functions/impulse-api/focus.js` - Weekly focus constraints
- `/ui-pages/public/app.js:391-452` - `computeWeeklyStats()`

### What Would Break
- **Timezone inconsistencies**: Different users seeing different week boundaries
- **Focus lockout**: Users unable to set focus areas due to week calculation errors
- **Statistics corruption**: Weekly stats showing incorrect data across boundaries
- **Daylight saving issues**: Week boundaries shifting unexpectedly

### Dependencies
- Client-side timezone calculations
- SQLite CURRENT_TIMESTAMP format parsing
- Weekly focus table constraints on `(room_code, player_uuid, week_key)`

### Modification Rules
- Consider moving to server-side week calculations
- Test across multiple timezones and DST transitions
- Verify focus area locking behavior

---

## 📊 Database Schema & Data Persistence

**Status**: Foundation layer - EXTREME CAUTION REQUIRED
**Impact Level**: CRITICAL - Data loss and corruption potential

### Current Implementation
- Complex relational schema with multiple constraints
- Database migrations via `ALTER TABLE` operations
- Retry logic for SQLite concurrency issues
- localStorage for user session data
- UUID-based user identification

### Critical Functions
- `/functions/impulse-api/init-db.js` - Complete schema initialization
- `/functions/impulse-api/_util.js:14-32` - `upsertWithRetry()` function
- Multiple `CREATE INDEX` and constraint operations

### What Would Break
- **Schema corruption**: Failed migrations leaving database inconsistent
- **Constraint violations**: Breaking unique indexes causing app failures
- **Deadlocks**: Concurrent operations causing database locks
- **Data loss**: Failed transactions during schema changes
- **User identity loss**: localStorage clearing creating duplicate users

### Dependencies
- D1 SQLite database binding (`env.DB`)
- Complex unique constraints and foreign key relationships
- User ID generation and persistence
- Room membership tracking

### Modification Rules
- **ANY** schema changes require backup strategies and rollback plans
- Test migrations thoroughly in staging environment
- Consider adding user merging mechanisms for lost sessions
- Implement proper data migration strategies

---

## 🔒 User Authentication & Session Handling

**Status**: Anonymous system - MODERATE-HIGH CAUTION
**Impact Level**: MODERATE-HIGH - User access and data isolation

### Current Implementation
- Anonymous UUID-based user system with localStorage persistence
- User record creation and UPSERT operations
- Session management across browser sessions

### Critical Functions
- `/ui-pages/public/app.js:8-65` - UUID generation and user management
- `/functions/impulse-api/user.js` - User CRUD operations with onboarding tracking
- localStorage keys: `'impulse_user_id'` and `'iw.session'`

### What Would Break
- **User identity loss**: localStorage clearing could create duplicate users
- **Orphaned data**: User records without corresponding entries/memberships
- **Concurrency issues**: Multiple tabs creating conflicting user records

### Dependencies
- `users` table with onboarding completion tracking
- Client-side UUID generation and persistence
- UPSERT retry logic for concurrent user creation

---

## Before Making Changes

1. **Check this file first** - Is the system documented here?
2. **Run analysis** - Use agents to analyze impact
3. **Document reasoning** - Why is the change needed?
4. **Test thoroughly** - Especially timestamp displays and calculations
5. **Update this file** - Document any changes made

## Change Log

- **2025-01-17**: Fixed timestamp parsing to properly handle SQLite UTC timestamps as UTC (not local)
- **2025-01-17**: Created this critical systems documentation