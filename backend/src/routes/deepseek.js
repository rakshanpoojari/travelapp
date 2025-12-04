const express = require('express');
const router = express.Router();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) {
  console.warn('DEEPSEEK_API_KEY not set in backend/.env or environment');
}

// POST /api/deepseek - proxy to DeepSeek API
router.post('/deepseek', async (req, res) => {
  try {
    if (!DEEPSEEK_KEY) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured on server' });
    }

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    // Filter out system messages and convert to DeepSeek format
    const deepseekMessages = messages
      .filter(m => m.role !== 'system') // DeepSeek doesn't use system role in the same way
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

    // Add a system message if needed (optional, can customize)
    const payload = {
      model: 'deepseek-chat',
      messages: deepseekMessages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false
    };

    // Call DeepSeek API
    const deepseekUrl = 'https://api.deepseek.com/chat/completions';

    const response = await fetch(deepseekUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DeepSeek API error: ${response.status}`, errorText);
      return res.status(response.status).json({
        error: `DeepSeek API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();

    // Extract text from DeepSeek response
    // DeepSeek returns: { choices: [{ message: { role, content } }], ... }
    const assistantText = data?.choices?.[0]?.message?.content ?? 'No response from DeepSeek';

    res.json({
      assistant: { text: assistantText },
      raw: data
    });

  } catch (err) {
    console.error('DeepSeek proxy error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to call DeepSeek API' });
  }
});

module.exports = router;
