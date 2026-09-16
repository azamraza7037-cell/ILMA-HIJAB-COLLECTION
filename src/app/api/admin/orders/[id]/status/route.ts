import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreOrderStock } from '@/lib/inventory';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { status } = body;
    if (!status || (status !== 'CONFIRMED' && status !== 'REJECTED')) {
      return NextResponse.json({ error: 'Invalid status. Must be CONFIRMED or REJECTED.' }, { status: 400 });
    }

    const existingOrder = await prisma.order.findUnique({ where: { id } });
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (existingOrder.status === status) {
      return NextResponse.json({ error: `Order already ${status}` }, { status: 400 });
    }

    if (status === 'REJECTED') {
      try {
        await restoreOrderStock(prisma, existingOrder.id);
      } catch (e) {
        console.warn('Stock restore failed', e);
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error updating order status', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PUT = POST;
