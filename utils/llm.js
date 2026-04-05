import axios from 'axios';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.MODEL || 'meta-llama/llama-3-8b-instruct:free';

export async function generateNotes(transcript, videoUrl) {
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

  const userPrompt = `YouTube URL: ${videoUrl}\n\nTranscript:\n${transcript.substring(0, 12000)}`;

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 2000
  };

  try {
    const response = await axios.post(OPENROUTER_URL, payload, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter error:', error.response?.data || error.message);
    return null;
  }
}