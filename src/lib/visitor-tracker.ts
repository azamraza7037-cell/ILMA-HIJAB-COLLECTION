import prisma from '@/lib/prisma';

export type TrafficSource = 'Direct' | 'Google' | 'Instagram' | 'Facebook' | 'WhatsApp' | 'Referral' | 'Other';

export function classifyReferrer(referrerUrl?: string | null): TrafficSource {
  if (!referrerUrl || referrerUrl.trim() === '') {
    return 'Direct';
  }

  try {
    const url = new URL(referrerUrl);
    const host = url.hostname.toLowerCase();

    if (host.includes('google.')) return 'Google';
    if (host.includes('instagram.com') || host.includes('cdninstagram')) return 'Instagram';
    if (host.includes('facebook.com') || host.includes('fb.me') || host.includes('fbcdn')) return 'Facebook';
    if (host.includes('whatsapp') || host.includes('wa.me')) return 'WhatsApp';

    return 'Referral';
  } catch {
    return 'Other';
  }
}

export interface RecordEventInput {
  sessionId: string;
  visitorId: string;
  eventType: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  ipHash?: string;
  productId?: string;
  orderId?: string;
  metadata?: Record<string, any>;
}

export async function recordVisitorEvent(input: RecordEventInput) {
  const {
    sessionId,
    visitorId,
    eventType,
    pageUrl,
    referrer,
    userAgent,
    ipHash,
    productId,
    orderId,
    metadata,
  } = input;

  const now = new Date();
  const classifiedSource = classifyReferrer(referrer);

  // 1. Upsert Visitor Session
  await prisma.visitorSession.upsert({
    where: { sessionId },
    update: {
      lastActiveAt: now,
      lastPage: pageUrl || undefined,
      pageViews: eventType === 'PAGE_VIEW' ? { increment: 1 } : undefined,
      isActive: true,
      userAgent: userAgent || undefined,
      ipHash: ipHash || undefined,
    },
    create: {
      sessionId,
      visitorId,
      firstPage: pageUrl || '/',
      lastPage: pageUrl || '/',
      referrer: classifiedSource,
      userAgent: userAgent || null,
      ipHash: ipHash || null,
      pageViews: 1,
      isActive: true,
      createdAt: now,
      lastActiveAt: now,
    },
  });

  // 2. Insert Analytics Event
  const event = await prisma.analyticsEvent.create({
    data: {
      sessionId,
      eventType,
      pageUrl: pageUrl || null,
      productId: productId || null,
      orderId: orderId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: now,
    },
  });

  return event;
}

export async function getLiveOnlineVisitorsCount(): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const count = await prisma.visitorSession.count({
    where: {
      lastActiveAt: {
        gte: fiveMinutesAgo,
      },
      isActive: true,
    },
  });
  return count;
}
