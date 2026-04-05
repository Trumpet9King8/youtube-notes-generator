import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 86400 });

// Helper: extract video ID
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?]|$)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error('Could not extract video ID');
}

// Dynamic import for youtube-transcript (more robust)
let fetchTranscript;
try {
  const module = await import('youtube-transcript/dist/youtube-transcript.esm.js');
  fetchTranscript = module.fetchTranscript;
  console.log('✅ youtube-transcript loaded successfully');
} catch (err) {
  console.error('❌ Failed to load youtube-transcript:', err.message);
  // Fallback: try default import
  const fallback = await import('youtube-transcript');
  fetchTranscript = fallback.fetchTranscript || fallback.YoutubeTranscript?.fetchTranscript;
}

if (!fetchTranscript) {
  console.error('❌ Could not find fetchTranscript. Exiting.');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint
app.post('/api/generate', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  let videoId;
  try {
    videoId = extractVideoId(url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Check cache
  let transcript = cache.get(videoId);
  if (!transcript) {
    try {
      const items = await fetchTranscript(videoId);
      transcript = items.map(item => item.text).join(' ');
      cache.set(videoId, transcript);
    } catch (err) {
      return res.status(404).json({ error: 'No transcript found. Video must have captions.' });
    }
  }

  // Generate notes via OpenRouter
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'Server missing OpenRouter API key' });
  }

  const systemPrompt = `You are an expert educator. Convert the transcript into structured notes with:

# Lecture Notes

## Key Concepts
- (bullet points)

## Important Facts
- (bullet points)

## Step-by-Step Procedures
1. ...
2. ...

Use clear, simple language. No extra commentary.`;

  const userPrompt = `Transcript:\n${transcript.substring(0, 8000)}`;

  try {
    const axios = (await import('axios')).default;
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: process.env.MODEL || 'meta-llama/llama-3-8b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1500
    }, {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    const notes = response.data.choices[0].message.content;
    res.json({ success: true, notes, videoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI generation failed: ' + (err.response?.data?.error?.message || err.message) });
  }
});

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});