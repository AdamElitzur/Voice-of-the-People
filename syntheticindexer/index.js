
// { "q_hrjmlnc": "", "q_jbfcy4g": "", "q_wsfmd00": "" }
const supabase = require('@supabase/supabase-js')
require('dotenv').config()
// const { randomUUID } = require('crypto')

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

function sanitizeText(value) {
    if (typeof value !== 'string') return value ?? '';
    // Remove null bytes and normalize newlines/spaces
    return value
        .replace(/\u0000/g, '')
        .replace(/[\r\n\t]+/g, ' ')
        .trim();
}

async function main() {
    const fs = require('fs');
    const path = require('path');

    const jsonlPath = path.join(__dirname, 'political_ideologies.jsonl');
    const jsonlData = fs.readFileSync(jsonlPath, 'utf8');

    const lines = jsonlData.split('\n');

    const rows = [];
    const CAMPAIGN_ID = process.env.SYNTHETIC_CAMPAIGN_ID || process.env.CAMPAIGN_ID || "09c37e20-6ddd-428c-b47d-401a5dde7330";
    for (const raw of lines) {
        const line = raw && raw.trim();
        if (!line) continue; // skip empty
        let data;
        try {
            data = JSON.parse(line);
        } catch (err) {
            console.warn('Skipping invalid JSONL line');
            continue;
        }

        const answersObj = {
            q_hrjmlnc: sanitizeText(data?.q1?.answer || ''),
            q_jbfcy4g: sanitizeText(data?.q2?.answer || ''),
            q_wsfmd00: sanitizeText(data?.q3?.answer || ''),
        };

        const respondentMeta = {
            ip: '::1',
            source: null,
            consent: true,
            respondent: null,
            user_agent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        };

        rows.push({
            // let DB generate id default; provide campaign_id
            campaign_id: CAMPAIGN_ID,
            answers: answersObj,
            respondent_meta: respondentMeta,
        });
    }

    console.log(`Prepared ${rows.length} rows. Uploading…`);

    // Insert in batches to avoid payload limits
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabaseClient
            .from('form_responses')
            .insert(chunk, { returning: 'minimal' });
        if (error) {
            console.error('Batch insert failed at index', i, error);
            process.exitCode = 1;
            return;
        }
        console.log(`Inserted ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
    }

    console.log('Data inserted successfully');
}

main();