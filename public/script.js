document.getElementById('generateBtn').addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) {
    alert('Please enter a YouTube URL');
    return;
  }

  const loadingDiv = document.getElementById('loading');
  const resultDiv = document.getElementById('result');

  loadingDiv.classList.remove('hidden');
  resultDiv.innerHTML = '';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unknown error');

    // Format markdown-like text to HTML (simple conversion)
    let html = data.notes
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/`(.*?)`/g, '<code>$1</code>');

    resultDiv.innerHTML = `<h3>✅ Notes for video ID: ${data.videoId}</h3>${html}`;
  } catch (err) {
    resultDiv.innerHTML = `<div style="color: var(--safety-orange); padding: 1rem;">❌ Error: ${err.message}</div>`;
  } finally {
    loadingDiv.classList.add('hidden');
  }
});