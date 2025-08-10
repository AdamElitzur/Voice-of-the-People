## Backend Setup

1. Duplicate `env.example` to `.env` and fill values.
2. Install deps: `npm install`.
3. Run dev server: `npm run dev`.

### Required env

- `PORT`: default 4000
- `CORS_ORIGIN`: frontend origin
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`: from Clerk dashboard
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: from Supabase project settings
- `PINECONE_API_KEY`: from Pinecone console
- `OPENAI_API_KEY`: for embeddings when using OpenAI

### Routes

- `GET /health`: basic status
- `GET /protected`: requires Clerk; returns `userId`


