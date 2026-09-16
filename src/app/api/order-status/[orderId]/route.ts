import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const phone = new URL(request.url).searchParams.get('phone')?.trim();

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone verification is required.' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        orderId,
        customerPhone: phone,
      },
      select: {
        orderId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or phone verification failed.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order status lookup failed:', error);

    return NextResponse.json(
      { error: 'Unable to check order status.' },
      { status: 500 }
    );
  }
}