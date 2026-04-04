import 'dotenv/config';
import { fetchTranscript, YoutubeTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';
import axios from 'axios';
import { promises as fs } from 'fs';
import readline from 'readline';

// OpenRouter configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'minimax/minimax-m2.5';
// free model

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
  throw new Error('Could not extract video ID from URL');
}

async function getTranscript(videoId) {
  try {
    const transcriptItems = await fetchTranscript(videoId);
    const fullText = transcriptItems.map(item => item.text).join(' ');
    return fullText;
  } catch (error) {
    console.error('Error fetching transcript:', error.message);
    return null;
  }
}

async function generateNotes(transcript) {
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

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 1500
  };

  const headers = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(OPENROUTER_URL, payload, { headers });
    const data = response.data;
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    console.error('Unexpected API response:', JSON.stringify(data, null, 2));
    return null;
  } catch (error) {
    console.error('OpenRouter API error:', error.response?.data || error.message);
    return null;
  }
}

async function saveNotes(notes, videoId) {
  const filename = `notes_${videoId}.md`;
  await fs.writeFile(filename, notes, 'utf-8');
  console.log(`Notes saved to ${filename}`);
  return filename;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter YouTube URL: ', async (url) => {
    rl.close();
    if (!url) return console.log('No URL.');

    let videoId;
    try {
      videoId = extractVideoId(url);
      console.log(`Video ID: ${videoId}`);
    } catch (err) {
      return console.error(err.message);
    }

    console.log('Fetching transcript...');
    const transcript = await getTranscript(videoId);
    if (!transcript) {
      console.log('No captions found. Make sure the video has English captions.');
      return;
    }

    console.log(`Transcript length: ${transcript.length} chars`);
    console.log(`Generating notes using ${MODEL} (free)...`);
    const notes = await generateNotes(transcript);
    if (notes) {
      await saveNotes(notes, videoId);
      console.log('\n--- Notes Preview ---\n', notes.substring(0, 800));
    } else {
      console.log('Generation failed.');
    }
  });
}

main().catch(console.error);