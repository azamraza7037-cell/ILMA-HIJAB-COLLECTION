import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export interface DeductItem {
  productId: string;
  quantity: number;
  name?: string;
}

export async function deductOrderStock(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: DeductItem[]
) {
  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
    }

    const previousStock = product.stock;
    const newStock = previousStock - item.quantity;

    await tx.product.update({
      where: { id: product.id },
      data: { stock: newStock },
    });

    await tx.inventoryLog.create({
      data: {
        productId: product.id,
        previousStock,
        change: -item.quantity,
        newStock,
        eventType: 'ORDER_DEDUCTED',
        referenceId: orderId,
        note: `Order ${orderId} placed/confirmed`,
      },
    });

    // Check low stock threshold (e.g., <= 5 units)
    if (newStock <= 5) {
      await tx.adminNotification.create({
        data: {
          type: 'LOW_STOCK',
          title: '⚠️ Low Stock Alert',
          message: `${product.name} is running low! Only ${newStock} units left in stock.`,
          link: `/admin/products/${product.id}/edit`,
          metadata: JSON.stringify({ productId: product.id, currentStock: newStock }),
        },
      });
    }
  }
}

export async function restoreOrderStock(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  // Prevent duplicate restoration
  const existingCancellationLog = await tx.inventoryLog.findFirst({
    where: {
      referenceId: orderId,
      eventType: 'ORDER_CANCELLED',
    },
  });

  if (existingCancellationLog) {
    // Already restored
    return;
  }

  // Find original deduction logs
  const deductionLogs = await tx.inventoryLog.findMany({
    where: {
      referenceId: orderId,
      eventType: 'ORDER_DEDUCTED',
    },
  });

  if (deductionLogs.length === 0) {
    // If no deduction logs were recorded (e.g. legacy order), fallback to order.items
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (order && order.items.length > 0) {
      for (const item of order.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stock: true },
        });

        if (product) {
          const previousStock = product.stock;
          const newStock = previousStock + item.quantity;

          await tx.product.update({
            where: { id: product.id },
            data: { stock: newStock },
          });

          await tx.inventoryLog.create({
            data: {
              productId: product.id,
              previousStock,
              change: item.quantity,
              newStock,
              eventType: 'ORDER_CANCELLED',
              referenceId: orderId,
              note: `Order ${order.orderId || orderId} cancelled - stock restored`,
            },
          });
        }
      }
    }
    return;
  }

  for (const log of deductionLogs) {
    const product = await tx.product.findUnique({
      where: { id: log.productId },
      select: { id: true, stock: true },
    });

    if (product) {
      const restoredQuantity = Math.abs(log.change);
      const previousStock = product.stock;
      const newStock = previousStock + restoredQuantity;

      await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
      });

      await tx.inventoryLog.create({
        data: {
          productId: product.id,
          previousStock,
          change: restoredQuantity,
          newStock,
          eventType: 'ORDER_CANCELLED',
          referenceId: orderId,
          note: `Order cancellation stock reversal`,
        },
      });
    }
  }
}

export async function adjustProductStock(
  productId: string,
  newStock: number,
  eventType: 'STOCK_ADDED' | 'STOCK_REMOVED' | 'MANUAL_ADJUSTMENT',
  note?: string,
  referenceId?: string
) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    if (newStock < 0) {
      throw new Error('Stock cannot be negative.');
    }

    const previousStock = product.stock;
    const change = newStock - previousStock;

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    await tx.inventoryLog.create({
      data: {
        productId,
        previousStock,
        change,
        newStock,
        eventType,
        note: note || `Manual adjustment to ${newStock}`,
        referenceId,
      },
    });

    return updated;
  });
}
