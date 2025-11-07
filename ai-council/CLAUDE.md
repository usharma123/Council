# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Council is a Next.js application that implements a collaborative AI decision-making system. When users ask questions, multiple AI personas (each with distinct perspectives like Software Engineer, Product Manager, UX Designer, Data Scientist, Security Expert, and Ethicist) generate independent answers, vote on the best response, and determine a winner through consensus voting.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Runtime**: Bun (package manager and runtime)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Payments**: Stripe
- **AI Provider**: OpenRouter API (using gpt-oss-120b model)
- **UI**: React 19, Tailwind CSS 4, Radix UI components
- **Styling**: CSS variables for theming (light/dark mode support)

## Development Commands

```bash
# Install dependencies
bun install

# Run development server (http://localhost:3000)
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Prisma commands
bun run prisma:generate    # Generate Prisma Client
bun run prisma:migrate     # Run database migrations
bun run prisma:seed        # Seed database with default personas

# Direct Prisma commands (alternative)
bunx prisma generate
bunx prisma migrate dev
bunx prisma studio         # Open Prisma Studio GUI
```

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` - PostgreSQL connection string (pooled)
- `DATABASE_URL_UNPOOLED` - Direct PostgreSQL connection
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `OPENROUTER_API_KEY` - OpenRouter API key for AI calls
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key

## Architecture

### Core Concept: The Council System

The application implements a multi-stage collaborative AI process:

1. **Answer Phase**: All active personas independently answer the user's question
2. **Voting Phase**: Each persona votes for the best answer (excluding their own) using anonymized ballots
3. **Winner Selection**: The answer with the most votes becomes the displayed response
4. **Persistence**: All answers, votes, and results are stored for history viewing

### Database Schema

**User Model**: Stores user data from Clerk, credits system, and Stripe customer ID
**Persona Model**: Defines AI personas with system prompts, tracks performance stats (runs, wins, voteScore)
**CouncilRun Model**: Records each user query and links to winning answer
**PersonaAnswer Model**: Stores each persona's answer and vote for a specific council run
**CreditTransaction Model**: Tracks credit additions/deductions

### Key Architectural Patterns

#### API Route Structure

- `/api/ask/stream` - Server-Sent Events (SSE) streaming endpoint for real-time council deliberation
- `/api/runs/*` - Retrieve past council runs and their results
- `/api/personas/*` - CRUD operations for personas (admin functionality)
- `/api/me` - Get current user info and credits
- `/api/stripe/*` - Handle Stripe checkout and webhooks for credit purchases

#### Streaming Architecture

The `/api/ask/stream/route.ts` endpoint streams progress updates to the frontend:
- `phase` events: "Collecting answers..." → "Council members are voting..."
- `answer` events: Individual persona answers as they arrive
- `vote` events: Persona voting decisions with explanations
- `winner` event: Vote counts and winning persona ID
- `complete` event: Final answer, updated credits, personas array, runId

#### Client-Side State Management

The `Chat` component (`components/chat.tsx`) manages:
- Message history with user/assistant roles
- Real-time streaming state (`streamingPersonas`, `voteCounts`, `currentPhase`)
- Integration with chat history sidebar via `selectedRunId`
- SSE parsing and progressive UI updates

#### Credits System

- Users start with 10 free credits
- Each council run costs 1 credit
- When credits run out (402 response), user is redirected to Stripe checkout
- Stripe webhook handles successful payment → adds credits to user account

#### Authentication Flow

- Clerk middleware (`proxy.ts`) protects all routes except `/` and webhook endpoint
- `getOrCreateUser()` utility creates database user on first Clerk sign-in
- Clerk userId maps to database via `clerkId` field

### Component Structure

- `components/chat.tsx` - Main chat interface with streaming message display
- `components/chat-history.tsx` - Sidebar showing past council runs
- `components/chat-header.tsx` - Top header navigation
- `components/ui/*` - Radix UI component wrappers with custom styling
- `app/page.tsx` - Main app layout with sidebar, theme toggle, and chat
- `app/personas/page.tsx` - Admin UI for managing personas

### Persona System

Personas are defined in `prisma/seed.ts` with:
- **name**: Display name (e.g., "Software Engineer")
- **systemPrompt**: Instructions defining the persona's perspective and expertise
- **status**: "active" or "inactive" (only active personas participate)
- **Performance tracking**: runs, wins, voteScore, badJson counters

When modifying personas:
1. Update seed file or use personas admin page
2. Each persona must include voting instructions in their system prompt
3. JSON response format: `{"answer": string, "vote": string, "vote_explanation": string}`

### Voting Mechanism

To prevent bias:
- Ballots are anonymized with letter labels (A, B, C, etc.)
- Labels are randomly shuffled per voter
- Personas cannot vote for themselves (enforced via prompt and validation)
- Vote explanations are stored and displayed to users

## Common Development Tasks

### Adding a New Persona

1. Add to `prisma/seed.ts` seedPersonas array
2. Run `bun run prisma:seed`
3. Or use the personas admin page at `/personas`

### Modifying the Database Schema

1. Edit `prisma/schema.prisma`
2. Run `bunx prisma migrate dev --name description_of_change`
3. Run `bunx prisma generate` to update Prisma Client types

### Testing the Streaming API

Use the frontend or test with curl:
```bash
curl -X POST http://localhost:3000/api/ask/stream \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the best programming language?"}' \
  --no-buffer
```

### Debugging Prisma

- Use `bunx prisma studio` to inspect database visually
- Check generated client at `node_modules/.prisma/client`
- Prisma logs automatically appear in development mode

## Important Implementation Details

- **Prisma Config**: Uses custom `prisma.config.ts` to load environment variables from both `.env` and `.env.local`
- **Runtime**: Set to `nodejs` in API routes (not Edge runtime) due to Prisma requirements
- **Theme System**: Uses CSS custom properties in `app/globals.css` with class-based dark mode (`.dark`)
- **OpenRouter**: Configured with `response_format: { type: 'json_object' }` for structured outputs
- **Error Handling**: Bad JSON responses from AI are logged but don't crash the stream

## File Organization

```
app/
  api/          # API routes (Next.js App Router)
  personas/     # Admin page for persona management
  billing/      # Billing/credits related pages
  page.tsx      # Main application UI
  layout.tsx    # Root layout with Clerk provider
  globals.css   # Global styles and CSS variables

components/
  chat.tsx           # Main chat component with streaming
  chat-history.tsx   # Sidebar chat history
  chat-header.tsx    # Header component
  ui/                # Reusable UI components (Radix)

lib/
  prisma.ts              # Prisma client singleton
  get-or-create-user.ts  # User creation utility
  utils.ts               # Utility functions (cn)

prisma/
  schema.prisma   # Database schema
  seed.ts         # Seed data (personas)
  migrations/     # Database migrations

proxy.ts          # Clerk middleware configuration
```

## Testing Considerations

- Test with multiple personas active to see voting dynamics
- Try edge cases: all personas vote for different answers (ties)
- Verify credit deduction and 402 payment redirect flow
- Test with personas returning malformed JSON (should gracefully handle)
- Check dark/light theme switching across all components
