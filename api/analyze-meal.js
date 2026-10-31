// The Takeover — photo meal analysis (Vercel serverless function)
//
// The vision-model API key lives ONLY here, as a Vercel environment variable
// (GEMINI_API_KEY), so it never ships in the app's HTML where anyone could
// steal it and run up the bill.
//
// POST /api/analyze-meal   { image: "data:image/jpeg;base64,...." }
// 200                      { items: [{ name, kcal, protein, carbs, fat }], note }
// Errors                   { error: "message" }

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const PROMPT = [
  'You are a nutrition estimator for a meal-logging app.',
  'Look at the food photo and identify each distinct food or drink item,',
  'estimating the serving size as shown in the photo.',
  'Return ONLY valid JSON in exactly this shape:',
  '{"items":[{"name":"Grilled chicken breast","kcal":310,"protein":46,"carbs":0,"fat":12}],"note":"one short sentence about your assumptions"}',
  'protein, carbs and fat are in grams. Round to whole numbers.',
  'Be realistic about portions. If no food is visible, return {"items":[],"note":"No food recognized."}'
].join('\n');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Photo logging is not configured on the server yet (missing GEMINI_API_KEY).' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(body.image || '');
    if (!m) {
      res.status(400).json({ error: 'Expected a JPEG, PNG or WebP image.' });
      return;
    }
    if (m[2].length > 8 * 1024 * 1024) {
      res.status(413).json({ error: 'That image is too large. Try a closer, smaller photo.' });
      return;
    }

    const apiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: m[1], data: m[2] } }
            ]
          }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      }
    );

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(function () { return ''; });
      console.error('Gemini error', apiRes.status, detail.slice(0, 300));
      res.status(502).json({ error: 'The analysis service had a problem. Try again in a moment.' });
      return;
    }

    const data = await apiRes.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const text = parts.map(function (p) { return p.text || ''; }).join('');

    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) {
      const match = /\{[\s\S]*\}/.exec(text);
      if (match) parsed = JSON.parse(match[0]);
    }
    if (!parsed || !Array.isArray(parsed.items)) {
      res.status(502).json({ error: 'Could not read the analysis result. Try another photo.' });
      return;
    }

    const items = parsed.items.map(function (it) {
      return {
        name: String(it.name || 'Food').slice(0, 80),
        kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
        protein: Math.max(0, Math.round(Number(it.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
        fat: Math.max(0, Math.round(Number(it.fat) || 0))
      };
    });

    res.status(200).json({ items: items, note: String(parsed.note || '').slice(0, 240) });
  } catch (e) {
    console.error('analyze-meal failed', e);
    res.status(500).json({ error: 'Something went wrong analyzing that photo.' });
  }
};
