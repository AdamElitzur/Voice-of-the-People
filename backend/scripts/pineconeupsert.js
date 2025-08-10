const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
require('dotenv').config({ override: true });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("vibrant-fir", "https://vibrant-fir-sw32of4.svc.aped-4627-b74a.pinecone.io");


texts = [
  "hi world",
]

async function createEmbeddingsFromTexts(inputTexts) {
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: inputTexts,
  });
  return data.map((item) => item.embedding);
}

async function upsert(text) {


  try {
    const embeddings = await createEmbeddingsFromTexts([text]);
    // get current timestamp
    const timestamp = Date.now();
    // into a string
    const timestampString = timestamp.toString();
    const vectors = embeddings.map((values, i) => ({
      id: `text-${i + 1}-${timestampString}`,
      values,
      metadata: { text: texts[i] },
    }));

    const response = await index.upsert(vectors);
    console.log('[pinecone upsert] success:', response);
  } catch (error) {
    console.error('[pinecone upsert] error:', error);
    process.exitCode = 1;
  }
}

// upsert();

exports.upsert = upsert;