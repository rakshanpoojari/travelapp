const express = require('express');
const router = express.Router();
const axios = require('axios');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
// Allow overriding the model via env (use Gemini AI Studio model names)
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
if (!GEMINI_KEY) {
  console.warn('GEMINI_API_KEY not set in backend/.env');
}

// POST /api/gemini - proxy to Google Gemini API
router.post('/gemini', async (req, res) => {
  try {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    // Convert our message format to Gemini API format
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model', // Gemini uses 'user' and 'model' roles
      parts: [{ text: m.text }]
    }));

    // Call Google Gemini API (generativelanguage.googleapis.com)
    // Use configured model (defaults to a Vertex AI model that supports generateContent)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

    const payload = {
      contents: contents,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    };

    const response = await axios.post(geminiUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      params: {
        key: GEMINI_KEY
      }
    });

    // Extract text from Gemini response
    const assistantText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response from Gemini';

    res.json({
      assistant: { text: assistantText },
      raw: response.data
    });

  } catch (err) {
    console.error('Gemini API error:', err.message);
    if (err.response) {
      return res.status(err.response.status).json({ error: err.response.data || err.message });
    }
    res.status(500).json({ error: err.message || 'Failed to call Gemini API' });
  }
});

module.exports = router;
