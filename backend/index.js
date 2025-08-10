/* eslint-disable no-console */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');

// Environment
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.env.CLERK_SECRET_KEY) {
    console.warn('[WARN] Missing CLERK_SECRET_KEY. Clerk-protected routes will fail until this is set.');
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[WARN] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Supabase client will not be fully functional.');
}

// Supabase (server-side: use service role key)
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    })
    : null;

// Express app
const app = express();

// Middleware
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Clerk (attaches auth to req)
app.use(clerkMiddleware());

// Routes
app.get('/health', (req, res) => {
    const status = {
        ok: true,
        env: {
            node: process.version,
            port: Number(PORT),
        },
        integrations: {
            clerkConfigured: Boolean(process.env.CLERK_SECRET_KEY),
            supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
        },
    };
    res.status(200).json(status);
});

app.get('/protected', requireAuth(), async (req, res) => {
    const { userId } = getAuth(req);
    // Example Supabase usage if configured
    let supabaseStatus = 'unconfigured';
    if (supabase) {
        try {
            // A lightweight request that should succeed even if there is no data table
            // We call auth.getUser with the current userId to validate connectivity. It requires service role key.
            const { data, error } = await supabase.auth.admin.getUserById(userId);
            if (error) throw error;
            supabaseStatus = data?.user ? 'ok' : 'ok';
        } catch (e) {
            supabaseStatus = `error: ${e.message}`;
        }
    }

    res.status(200).json({
        message: 'You have access to a protected route.',
        userId,
        supabaseStatus,
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Only start server if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}

module.exports = { app, supabase };


