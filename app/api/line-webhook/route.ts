import crypto from 'crypto';

type FAQCache = {
  text: string;
  ts: number;
};

const FAQ_CACHE: FAQCache = { text: '', ts: 0 };
const FAQ_TTL_MS = 60 * 1000; // 60 seconds

async function fetchFaqCsv(): Promise<string> {
  const url = process.env.SHEET_CSV_URL;
  if (!url) throw new Error('SHEET_CSV_URL not configured');

  const now = Date.now();
  if (FAQ_CACHE.text && now - FAQ_CACHE.ts < FAQ_TTL_MS) {
    return FAQ_CACHE.text;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch FAQ CSV: ${res.status}`);
  const text = await res.text();
  FAQ_CACHE.text = text;
  FAQ_CACHE.ts = Date.now();
  return text;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  const url = 'https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.5-flash:generate';
  const body = {
    prompt: { text: prompt },
    temperature: 0.2,
    maxOutputTokens: 512
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
  }

  const data = await res.json();

  // Extract text from possible response shapes
  let reply = '';
  if (Array.isArray(data?.candidates) && data.candidates.length) {
    reply = data.candidates.map((c: any) => c.output || (c.content || []).map((p: any) => p.text || '').join('')).join('\n');
  }
  if (!reply && Array.isArray(data?.output) && data.output.length && Array.isArray(data.output[0].content)) {
    reply = data.output[0].content.map((p: any) => p.text || '').join('');
  }
  if (!reply && typeof data?.outputText === 'string') reply = data.outputText;

  return (reply || '').trim();
}

async function replyToLine(replyToken: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');

  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: message }] })
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';
  const secret = process.env.LINE_CHANNEL_SECRET || '';

  if (!secret) {
    return new Response('LINE channel secret not configured', { status: 500 });
  }

  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
  if (hash !== signature) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    return new Response('Bad Request', { status: 400 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  if (!events.length) return new Response('OK', { status: 200 });

  // Fetch FAQ once (cached)
  let faq = '';
  try {
    faq = await fetchFaqCsv();
  } catch (err) {
    faq = '';
    console.error('Failed to fetch FAQ CSV', err);
  }

  for (const ev of events) {
    try {
      if (ev.type !== 'message' || ev.message?.type !== 'text') continue;
      const userText = ev.message.text;
      const replyToken = ev.replyToken;

      const promptParts: string[] = [];
      if (faq) promptParts.push(`FAQ CSV:\n${faq}`);
      promptParts.push(`User message:\n${userText}`);
      promptParts.push('Answer concisely in Thai using only the FAQ information when possible. If the FAQ does not contain the answer, reply: "ยังไม่มีข้อมูลส่วนนี้ในระบบครับ กรุณาตรวจสอบกับผู้รับผิดชอบอีกครั้งครับ"');
      const prompt = promptParts.join('\n\n');

      let answer = '';
      try {
        answer = await callGemini(prompt);
      } catch (err) {
        console.error('Gemini call failed', err);
        answer = '';
      }

      const finalAnswer = answer && answer.trim() ? answer.trim() : 'ยังไม่มีข้อมูลส่วนนี้ในระบบครับ กรุณาตรวจสอบกับผู้รับผิดชอบอีกครั้งครับ';
      try {
        await replyToLine(replyToken, finalAnswer);
      } catch (err) {
        console.error('Reply to LINE failed', err);
      }
    } catch (err) {
      console.error('Event handling error', err);
    }
  }

  return new Response('OK', { status: 200 });
}
