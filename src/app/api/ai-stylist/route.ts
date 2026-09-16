import { NextResponse } from 'next/server';
import { processCustomerMessage } from '@/lib/ai-concierge';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const message = String(body?.message || '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required.' },
        { status: 400 }
      );
    }

    const response = await processCustomerMessage(message, history);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('AI Stylist failed:', error);

    return NextResponse.json(
      {
        error: 'AI Stylist is temporarily unavailable.',
        reply:
          'I am sorry, I could not process that right now. Please browse our collection or contact us on WhatsApp.',
      },
      { status: 500 }
    );
  }
}
