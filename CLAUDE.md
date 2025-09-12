# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Impulse Wallet is a Cloudflare Pages application with:

- **Frontend**: Static HTML/CSS/JS files in `ui-pages/public/`
- **Backend**: Cloudflare Pages Functions in `functions/impulse-api/`
- **Database**: Cloudflare D1 SQLite database
- **Deployment**: Uses Wrangler for development and deployment

The application follows a serverless architecture where:
- Static assets are served from Pages
- API endpoints are handled by Pages Functions (avoiding CORS issues)
- All API routes are prefixed with `/impulse-api/`
- Database operations use Cloudflare D1 bindings

## Development Commands

**Start local development server:**
```bash
npm run dev
```
This runs `wrangler pages dev` on port 8788 with compatibility date 2024-09-01.

**Run tests:**
```bash
npm test
```
This executes the automated API test suite (`test/run-tests.js`). The dev server must be running first.

**Deploy to staging:**
```bash
npm run deploy:staging
```

**Deploy to production:**
```bash
npm run deploy:prod
```

## Key Components

### Database Schema
The D1 database includes tables for:
- `events` - System events and user actions
- `rooms` - Room management with invite codes and settings
- `users` - User profiles and metadata  
- `room_members` - Room membership relationships

Initialize database tables via `/impulse-api/init-db` POST endpoint.

### API Structure
All API functions are in `functions/impulse-api/`:
- `health.js` - Health check endpoint
- `user.js` - User management (UPSERT pattern)
- `room.js` - Room creation and validation
- `room-manage.js` - Room membership operations
- `room-suggestions.js` - Generate unique room codes
- `events.js` - Event logging and retrieval
- `state.js` - Application state management
- `focus.js` - User focus/presence tracking

### Frontend Architecture
- Single-page application in `ui-pages/public/`
- Uses vanilla JavaScript with localStorage for user persistence
- Anonymous user system with UUID generation
- Real-time features via periodic polling

## Database Connection

The wrangler.toml configures D1 database binding:
- Local development: Uses `impulse-wallet-local` database
- Database binding name: `DB` (accessed via `env.DB` in functions)

## Testing

The test suite (`test/run-tests.js`) validates:
- Health endpoint functionality
- User CRUD operations (create, read, update)
- Room code validation and suggestions
- Event logging system
- Error handling for invalid requests

Tests expect the local dev server running on port 8788.