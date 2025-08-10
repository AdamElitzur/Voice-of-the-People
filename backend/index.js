/* eslint-disable no-console */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
// Optional: legacy upsert helper
let upsert;
try {
    // eslint-disable-next-line global-require, import/no-unresolved
    ({ upsert } = require('./scripts/pineconeupsert'));
} catch (_) {
    // no-op if helper missing
}

// Environment
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'vibrant-fir';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!process.env.CLERK_SECRET_KEY) {
    console.warn('[WARN] Missing CLERK_SECRET_KEY. Clerk-protected routes will fail until this is set.');
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[WARN] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Supabase client will not be fully functional.');
}
if (!PINECONE_API_KEY) {
    console.warn('[WARN] Missing PINECONE_API_KEY. Pinecone routes will fail until this is set.');
}
if (!OPENAI_API_KEY) {
    console.warn('[WARN] Missing OPENAI_API_KEY. Embedding generation will fail until this is set.');
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
app.use(cors({ origin: '*', credentials: true }));
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
            pineconeConfigured: Boolean(PINECONE_API_KEY),
            openaiConfigured: Boolean(OPENAI_API_KEY),
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

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pc.index("vibrant-fir", "https://vibrant-fir-sw32of4.svc.aped-4627-b74a.pinecone.io");
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// POST /api/query { text, topK }
app.post('/api/query', async (req, res) => {
    try {
        if (!openai || !pineconeIndex) {
            return res.status(500).json({ error: 'Server missing OpenAI or Pinecone configuration' });
        }
        const { text } = req.body || {};
        let { topK } = req.body || {};
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'text is required' });
        }
        const k = Number.isFinite(Number(topK)) ? Math.max(1, Math.min(200, Number(topK))) : 20;

        const { data } = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        });
        const embedding = data[0].embedding;

        const result = await pineconeIndex.query({
            vector: embedding,
            topK: k,
            includeValues: true,
            includeMetadata: true,
        });

        const points = (result.matches || []).map((m) => ({
            id: m.id,
            score: m.score,
            values: m.values,
            metadata: m.metadata || {},
        }));

        res.status(200).json({
            query: { text, embedding },
            points,
            topK: k,
        });
    } catch (err) {
        console.error('[/api/query] error:', err);
        res.status(500).json({ error: err.message || 'query failed' });
    }
});



app.post('/upsert', requireAuth(), async (req, res) => {
    const { texts } = req.body;
    const response = await upsert(texts);
    console.log('[upsert] success:', response);

    res.status(200).json({ success: true });
});

// ===== Campaigns, Forms, Responses API =====

function ensureSupabase(res) {
    if (!supabase) {
        res.status(500).json({ error: 'Supabase is not configured on the server' });
        return false;
    }
    return true;
}

function getClerkUserId(req) {
    const { userId } = getAuth(req);
    return userId;
}

function generateShareSlug() {
    const random = Math.random().toString(36).slice(2, 8);
    const ts = Date.now().toString(36).slice(-4);
    return `${random}${ts}`;
}

function flattenAnswersForEmbedding(input) {
    if (!input) return '';
    const parts = [];
    const walk = (value, path) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) {
            value.forEach((v, i) => walk(v, `${path}[${i}]`));
        } else if (typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
                walk(v, path ? `${path}.${k}` : k);
            }
        } else {
            parts.push(`${path}: ${String(value)}`);
        }
    };
    walk(input, '');
    return parts.join('\n');
}

async function embedTextForResponse(text) {
    if (!openai) throw new Error('OpenAI not configured');
    const { data } = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return data[0].embedding;
}

async function upsertResponseEmbedding({ campaignId, responseId, text, extraMetadata = {} }) {
    if (!pineconeIndex) return;
    const embedding = await embedTextForResponse(text);
    const vector = {
        id: `resp:${responseId}`,
        values: embedding,
        metadata: { campaignId, responseId, text, ...extraMetadata },
    };
    await pineconeIndex.upsert([vector]);
}

// POST /api/campaigns - create a campaign
// body: { title, description, form_schema, example_inputs, multiple_choice_options, is_published }
app.post('/api/campaigns', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        const {
            title,
            description,
            form_schema = {},
            example_inputs = null,
            multiple_choice_options = null,
            is_published = false,
        } = req.body || {};
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'title is required' });
        }
        const share_slug = generateShareSlug();
        const { data, error } = await supabase
            .from('campaigns')
            .insert({
                title,
                description,
                form_schema,
                example_inputs,
                multiple_choice_options,
                is_published,
                share_slug,
                created_by: userId,
            })
            .select('*')
            .single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('[/api/campaigns][POST] error', err);
        res.status(500).json({ error: err.message || 'create failed' });
    }
});

// GET /api/campaigns - list campaigns for current user
app.get('/api/campaigns', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('created_by', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.status(200).json(data || []);
    } catch (err) {
        console.error('[/api/campaigns][GET] error', err);
        res.status(500).json({ error: err.message || 'list failed' });
    }
});

// GET /api/campaigns/:id - get single campaign (owner only)
app.get('/api/campaigns/:id', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        const { id } = req.params;
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .eq('created_by', userId)
            .single();
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error('[/api/campaigns/:id][GET] error', err);
        res.status(500).json({ error: err.message || 'fetch failed' });
    }
});

app.post('/api/newAdmin', requireAuth(), async (req, res) => {
    const { text } = req.body;
    const response = await upsert(text);
    console.log('[upsert] success:', response);
    // check if user is in the admi
    const { data: admins, error: adminsError } = await supabase
        .from('admins')
        .select('*')
        .eq('clerk_user_id', userId)
        .single();
    if (adminsError) throw adminsError;
    if (admins.length === 0) {
        // create admin
        const { data: admin, error: adminError } = await supabase
            .from('admins')
            .insert({
                clerk_user_id: userId,
            })
            .select('*')
            .single();
    }
    res.status(200).json({ success: true });
});

// PATCH /api/campaigns/:id - update campaign (owner only)
app.patch('/api/campaigns/:id', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        const { id } = req.params;
        const updates = req.body || {};
        delete updates.id;
        delete updates.created_by;
        const { data, error } = await supabase
            .from('campaigns')
            .update(updates)
            .eq('id', id)
            .eq('created_by', userId)
            .select('*')
            .single();
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error('[/api/campaigns/:id][PATCH] error', err);
        res.status(500).json({ error: err.message || 'update failed' });
    }
});

// DELETE /api/campaigns/:id - delete campaign (owner only)
app.delete('/api/campaigns/:id', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        const { id } = req.params;
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id)
            .eq('created_by', userId);
        if (error) throw error;
        res.status(204).send();
    } catch (err) {
        console.error('[/api/campaigns/:id][DELETE] error', err);
        res.status(500).json({ error: err.message || 'delete failed' });
    }
});

// GET /api/campaigns/:id/responses - list responses (owner only)
app.get('/api/campaigns/:id/responses', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        const { id } = req.params;
        // ensure ownership
        const { data: camp, error: campErr } = await supabase
            .from('campaigns')
            .select('id')
            .eq('id', id)
            .eq('created_by', userId)
            .single();
        if (campErr) throw campErr;
        const { data, error } = await supabase
            .from('form_responses')
            .select('*')
            .eq('campaign_id', id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.status(200).json(data || []);
    } catch (err) {
        console.error('[/api/campaigns/:id/responses][GET] error', err);
        res.status(500).json({ error: err.message || 'list failed' });
    }
});

// GET /api/dashboard - campaigns + response counts (owner only)
app.get('/api/dashboard', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        // Prefer using a view if created; fallback to join-less approach
        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('created_by', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        const campaignIds = (campaigns || []).map(c => c.id);
        let countsByCampaign = {};
        if (campaignIds.length) {
            const { data: respRows, error: respErr } = await supabase
                .from('form_responses')
                .select('campaign_id')
                .in('campaign_id', campaignIds);
            if (respErr) throw respErr;
            for (const row of respRows || []) {
                if (!countsByCampaign[row.campaign_id]) countsByCampaign[row.campaign_id] = 0;
                countsByCampaign[row.campaign_id] += 1;
            }
        }
        const enriched = (campaigns || []).map(c => ({
            ...c,
            response_count: countsByCampaign[c.id] || 0,
        }));
        res.status(200).json(enriched);
    } catch (err) {
        console.error('[/api/dashboard][GET] error', err);
        res.status(500).json({ error: err.message || 'dashboard failed' });
    }
});

// ===== Public form endpoints =====

// GET /api/public/campaigns/:slug - retrieve published campaign for public form
app.get('/api/public/campaigns/:slug', async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const { slug } = req.params;
        const { data, error } = await supabase
            .from('campaigns')
            .select('id, title, description, form_schema, share_slug, is_published')
            .eq('share_slug', slug)
            .eq('is_published', true)
            .single();
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error('[/api/public/campaigns/:slug][GET] error', err);
        res.status(404).json({ error: 'campaign not found' });
    }
});

// POST /api/public/campaigns/:slug/submit - submit a response
// body: { answers: object, respondent: { optional info }, source?: 'web'|'share'|'social', consent?: boolean }
app.post('/api/public/campaigns/:slug/submit', async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const { slug } = req.params;
        const { answers = {}, respondent = null, source = null, consent = true } = req.body || {};
        const { data: campaign, error: cErr } = await supabase
            .from('campaigns')
            .select('id, title, description, is_published')
            .eq('share_slug', slug)
            .eq('is_published', true)
            .single();
        if (cErr || !campaign) {
            return res.status(404).json({ error: 'campaign not found' });
        }
        const respondent_meta = {
            user_agent: req.get('user-agent') || null,
            ip: req.ip || null,
            source,
            respondent,
        };
        const { data: inserted, error: insErr } = await supabase
            .from('form_responses')
            .insert({
                campaign_id: campaign.id,
                answers,
                respondent_clerk_id: null,
                respondent_meta,
            })
            .select('*')
            .single();
        if (insErr) throw insErr;
        // Build text to embed and upsert to Pinecone
        const text = `${campaign.title || ''}\n${campaign.description || ''}\n\n${flattenAnswersForEmbedding(answers)}`.trim();
        try {
            await upsertResponseEmbedding({
                campaignId: campaign.id,
                responseId: inserted.id,
                text,
                extraMetadata: { title: campaign.title || null },
            });
        } catch (e) {
            console.warn('[pinecone upsert failed for response]', e.message);
        }
        res.status(201).json(inserted);
    } catch (err) {
        console.error('[/api/public/campaigns/:slug/submit][POST] error', err);
        res.status(500).json({ error: err.message || 'submit failed' });
    }
});

// ===== Insights & RAG =====

// POST /api/campaigns/:id/ask - ask LLM about responses in a campaign
// body: { question: string, topK?: number }
app.post('/api/campaigns/:id/ask', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        if (!openai || !pineconeIndex) {
            return res.status(500).json({ error: 'Server missing OpenAI or Pinecone configuration' });
        }
        const userId = getClerkUserId(req);
        const { id } = req.params;
        const { question, topK = 20 } = req.body || {};
        if (!question || typeof question !== 'string') {
            return res.status(400).json({ error: 'question is required' });
        }
        // ownership check
        const { error: campErr } = await supabase
            .from('campaigns')
            .select('id')
            .eq('id', id)
            .eq('created_by', userId)
            .single();
        if (campErr) throw campErr;
        const { data: embData } = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: question,
        });
        const qEmbedding = embData[0].embedding;
        const result = await pineconeIndex.query({
            vector: qEmbedding,
            topK: Math.max(1, Math.min(200, Number(topK) || 20)),
            includeValues: false,
            includeMetadata: true,
            filter: { campaignId: id },
        });
        const contexts = (result.matches || []).map((m) => m.metadata?.text || m.metadata?.title || '');
        const systemPrompt = 'You are an analyst. Answer based only on the provided constituent responses. Provide concise, neutral, non-partisan insights.';
        const contextText = contexts.filter(Boolean).slice(0, 50).join('\n---\n');
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Question: ${question}\n\nData:\n${contextText}` },
        ];
        const chat = await openai.chat.completions.create({
            model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
            messages,
            temperature: 0.2,
        });
        const answer = chat.choices?.[0]?.message?.content || '';
        res.status(200).json({ answer, used: contexts.length });
    } catch (err) {
        console.error('[/api/campaigns/:id/ask][POST] error', err);
        res.status(500).json({ error: err.message || 'ask failed' });
    }
});

// Simple metrics: GET /api/campaigns/:id/metrics
app.get('/api/campaigns/:id/metrics', requireAuth(), async (req, res) => {
    try {
        if (!ensureSupabase(res)) return;
        const userId = getClerkUserId(req);
        const { id } = req.params;
        // ownership check
        const { error: campErr } = await supabase
            .from('campaigns')
            .select('id')
            .eq('id', id)
            .eq('created_by', userId)
            .single();
        if (campErr) throw campErr;
        const { data: responses, error } = await supabase
            .from('form_responses')
            .select('id, created_at')
            .eq('campaign_id', id)
            .order('created_at', { ascending: true });
        if (error) throw error;
        const total = responses?.length || 0;
        res.status(200).json({ total });
    } catch (err) {
        console.error('[/api/campaigns/:id/metrics][GET] error', err);
        res.status(500).json({ error: err.message || 'metrics failed' });
    }
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


