import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 86400 }); // 24 hours

export async function getTranscript(videoId) {
  const cached = cache.get(videoId);
  if (cached) return cached;

  try {
    const transcriptItems = await fetchTranscript(videoId);
    const fullText = transcriptItems.map(item => item.text).join(' ');
    cache.set(videoId, fullText);
    return fullText;
  } catch (error) {
    console.error('Transcript fetch error:', error.message);
    return null;
  }
}