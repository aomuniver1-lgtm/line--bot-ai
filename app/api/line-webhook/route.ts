import crypto from 'crypto';

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

  try {
    // Basic acknowledgement — real event handling can be implemented here.
    // Parse events if needed:
    // const payload = JSON.parse(body);
    return new Response('OK', { status: 200 });
  } catch (err) {
    return new Response('Bad Request', { status: 400 });
  }
}
