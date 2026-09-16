import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deductOrderStock } from '@/lib/inventory';
import { products as catalogProducts } from '@/data/products';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const items = Array.isArray(body?.items) ? body.items : [];
    const customerInfo = body?.customerInfo;

    if (!items.length) {
      return NextResponse.json(
        { error: 'At least one product is required.' },
        { status: 400 }
      );
    }

    if (
      !customerInfo?.name ||
      !customerInfo?.phone ||
      !customerInfo?.addressLine1 ||
      !customerInfo?.city ||
      !customerInfo?.state ||
      !customerInfo?.postalCode
    ) {
      return NextResponse.json(
        { error: 'Please provide complete delivery information.' },
        { status: 400 }
      );
    }

    const requestedItems = items.map((item: any) => ({
      productId: String(item.productId || ''),
      quantity: Math.max(1, Number(item.quantity) || 1),
      color: item.color ? String(item.color) : null,
      size: item.size ? String(item.size) : null,
    }));

    const order = await prisma.$transaction(async (tx) => {
      const resolvedProducts = [];

      for (const item of requestedItems) {
        let product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          const catalogProduct = catalogProducts.find(
            (p) => p.id === item.productId || p.slug === item.productId
          );

          if (catalogProduct) {
            product = await tx.product.findUnique({
              where: { slug: catalogProduct.slug },
            });
          }
        }

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.status !== 'ACTIVE') {
          throw new Error(`${product.name} is currently unavailable.`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.stock}`
          );
        }

        resolvedProducts.push({ item, product });
      }

      const subtotal = resolvedProducts.reduce(
        (sum, entry) =>
          sum +
          (entry.product.salePrice ?? entry.product.originalPrice) *
            entry.item.quantity,
        0
      );

      const shippingFee = 0;
      const tax = 0;
      const discount = 0;
      const totalAmount = subtotal + shippingFee + tax - discount;

      const phone = String(customerInfo.phone).trim();
      const email = String(customerInfo.email || '').trim();

      const customer = await tx.customer.upsert({
        where: { phone },
        update: {
          name: String(customerInfo.name),
          email: email || undefined,
          whatsapp: String(customerInfo.whatsapp || phone),
          lastOrderAt: new Date(),
          totalOrders: { increment: 1 },
          totalSpent: { increment: totalAmount },
        },
        create: {
          name: String(customerInfo.name),
          email: email || null,
          phone,
          whatsapp: String(customerInfo.whatsapp || phone),
          lastOrderAt: new Date(),
          totalOrders: 1,
          totalSpent: totalAmount,
        },
      });

      const orderId = `ILMA-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`;

      const created = await tx.order.create({
        data: {
          orderId,
          customerName: String(customerInfo.name),
          customerEmail: email,
          customerPhone: phone,
          customerWhatsapp: String(customerInfo.whatsapp || phone),
          addressLine1: String(customerInfo.addressLine1),
          addressLine2: customerInfo.addressLine2
            ? String(customerInfo.addressLine2)
            : null,
          city: String(customerInfo.city),
          state: String(customerInfo.state),
          postalCode: String(customerInfo.postalCode),
          country: 'India',
          subtotal,
          shippingFee,
          tax,
          totalAmount,
          discount,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: String(body.paymentMethod || 'UPI'),
          customerId: customer.id,
          items: {
            create: resolvedProducts.map(({ item, product }) => ({
              productId: product.id,
              name: product.name,
              price: product.salePrice ?? product.originalPrice,
              quantity: item.quantity,
              color: item.color,
              size: item.size,
            })),
          },
        },
        include: { items: true },
      });

      await deductOrderStock(
        tx,
        created.id,
        resolvedProducts.map(({ item, product }) => ({
          productId: product.id,
          quantity: item.quantity,
          name: product.name,
        }))
      );

      return created;
    });

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error: any) {
    console.error('Order creation failed:', error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unable to create order. Please try again.',
      },
      { status: 500 }
    );
  }
}
