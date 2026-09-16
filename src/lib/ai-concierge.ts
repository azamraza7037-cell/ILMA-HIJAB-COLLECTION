// @ts-nocheck
import prisma from '@/lib/prisma';

export interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number;
  stock: number;
  image: string;
  category: string;
}

export interface ChatResponse {
  reply: string;
  products?: RecommendedProduct[];
  orderStatus?: {
    orderId: string;
    status: string;
    totalAmount: number;
  } | null;
}

export async function processCustomerMessage(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ChatResponse> {
  const query = userMessage.trim().toLowerCase();

  // 1. Fetch live products from DB
  const liveProducts = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      shortDescription: true,
      category: true,
      images: true,
      originalPrice: true,
      salePrice: true,
      stock: true,
      badge: true,
      fabricInfo: true,
    },
  });

  const parsedProducts: RecommendedProduct[] = liveProducts.map((p) => {
    let img = '/placeholder.jpg';
    try {
      const arr = JSON.parse(p.images);
      if (Array.isArray(arr) && arr.length > 0) img = arr[0];
    } catch {}

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.salePrice || p.originalPrice,
      originalPrice: p.originalPrice,
      stock: p.stock,
      image: img,
      category: p.category,
    };
  });

  // 2. Check if user is asking about a specific Order ID (e.g., IHC-XXXXXX)
  const orderIdMatch = query.match(/ihc-[a-z0-9]+/i);
  if (orderIdMatch) {
    const matchedOrderId = orderIdMatch[0].toUpperCase();

    // Privacy: order details are only shared after verifying the phone number
    // used for the order (same rule as /api/orders/track and /api/order-status).
    const phoneMatch = query.match(/\b\d{10}\b/);
    if (!phoneMatch) {
      return {
        reply: `For your privacy, I can only share order details after verifying the mobile number used while placing the order.\n\nPlease use our [Order Tracking Page](/track-order) with your Order ID and phone number — or paste both here (e.g., \`IHC-XXXXXX 9876543210\`) and I'll look it up for you.`,
      };
    }

    const order = await prisma.order.findFirst({
      where: {
        orderId: matchedOrderId,
        customerPhone: phoneMatch[0],
      },
      select: {
        orderId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    if (order) {
      return {
        reply: `Here are the live tracking details for Order **${order.orderId}**:\n\n• **Status**: ${order.status}\n• **Payment**: ${order.paymentStatus}\n• **Total Amount**: ₹${order.totalAmount.toLocaleString('en-IN')}\n• **Order Date**: ${new Date(order.createdAt).toLocaleDateString()}\n\nIf you need any adjustments or express delivery updates, our team on WhatsApp (+91 9286558531) is ready to help!`,
        orderStatus: {
          orderId: order.orderId,
          status: order.status,
          totalAmount: order.totalAmount,
        },
      };
    } else {
      return {
        reply: `I could not find an order matching **${matchedOrderId}** together with the phone number provided. Please double-check both your Order ID and the mobile number used for the order, or message our support on WhatsApp at +91 9286558531.`,
      };
    }
  }

  // 3. Try OpenAI if API key configured
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const catalogSummary = liveProducts.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        price: p.salePrice || p.originalPrice,
        stock: p.stock,
        fabric: p.fabricInfo,
        badge: p.badge,
        description: p.shortDescription || p.description,
      }));

      const systemPrompt = `You are "Ilma AI Concierge", the official modest fashion expert for Ilma Hijab Collection.
You guide customers with warmth, elegance, and Islamic modesty values.

STORE POLICIES:
- Delivery: 3-5 business days across India. Free shipping over ₹999 (otherwise ₹99).
- Payment: COD (Cash on Delivery) and Online UPI / Cards via Razorpay.
- Returns: 7-day hassle-free exchange/return for unworn items with tags intact.
- WhatsApp Support: +91 9286558531.

LIVE CATALOG (CRITICAL: Only recommend products from this list. NEVER invent products, prices, or fake stock):
${JSON.stringify(catalogSummary)}

RULES:
1. Ground answers strictly on real catalog data.
2. If recommending products, include their exact slugs.
3. Return JSON:
   {
     "reply": "friendly markdown formatted response",
     "recommendedSlugs": ["slug-1", "slug-2"]
   }`;

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-4),
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (aiRes.ok) {
        const json = await aiRes.json();
        const parsed = JSON.parse(json.choices[0].message.content);
        const slugs = parsed.recommendedSlugs || [];
        const recommended = parsedProducts.filter((p) => slugs.includes(p.slug));
        return {
          reply: parsed.reply,
          products: recommended.length > 0 ? recommended : undefined,
        };
      }
    } catch (e) {
      console.warn('OpenAI concierge failed, falling back to deterministic catalog engine:', e);
    }
  }

  // 4. Deterministic Natural Matching Engine (Grounded strictly on real DB data)
  let matchingProducts: RecommendedProduct[] = [];
  let responseText = '';

  if (query.includes('wedding') || query.includes('party') || query.includes('festive') || query.includes('occasion') || query.includes('luxury')) {
    matchingProducts = parsedProducts.filter((p) =>
      p.name.toLowerCase().includes('elegance') ||
      p.name.toLowerCase().includes('luxe') ||
      p.name.toLowerCase().includes('embroidered') ||
      p.price > 1800
    );
    if (matchingProducts.length === 0) matchingProducts = parsedProducts.slice(0, 2);

    responseText = `For weddings and special occasions, we recommend our premium, gracefully draped designs with exquisite details. Here are our top luxury picks available in stock:`;
  } else if (query.includes('daily') || query.includes('casual') || query.includes('office') || query.includes('college') || query.includes('everyday')) {
    matchingProducts = parsedProducts.filter((p) =>
      p.name.toLowerCase().includes('nida') ||
      p.name.toLowerCase().includes('marble') ||
      p.name.toLowerCase().includes('black')
    );
    if (matchingProducts.length === 0) matchingProducts = parsedProducts.slice(0, 2);

    responseText = `For everyday wear, lightweight breathable fabrics like Korean Nida offer all-day comfort while maintaining a chic, graceful silhouette. Here are our top daily favorites:`;
  } else if (query.includes('shipping') || query.includes('delivery') || query.includes('courier') || query.includes('days')) {
    responseText = `📦 **Shipping & Delivery Details**:\n\n• **Standard Delivery**: 3 to 5 business days anywhere in India.\n• **Free Shipping**: Automatically applied to all orders above ₹999! (Orders below ₹999 incur a flat ₹99 fee).\n• **Cash on Delivery (COD)**: Available at checkout.`;
  } else if (query.includes('return') || query.includes('exchange') || query.includes('refund')) {
    responseText = `🔄 **Return & Exchange Policy**:\n\nWe offer a **7-day hassle-free return or exchange** guarantee. The item must be unused, unwashed, and in its original packaging with all tags attached. You can initiate a return directly via WhatsApp (+91 9286558531).`;
  } else if (query.includes('track') || query.includes('status')) {
    responseText = `🔍 **Order Tracking**:\n\nYou can track your order live anytime on our [Order Tracking Page](/track-order) by entering your Order ID (e.g. \`IHC-XXXXXX\`) and phone number.\n\nYou can also paste your Order ID along with the mobile number used for the order right here in the chat, and I'll look it up for you!`;
  } else if (query.includes('human') || query.includes('support') || query.includes('whatsapp') || query.includes('contact') || query.includes('call')) {
    responseText = `💬 You can chat directly with our founder and styling team on WhatsApp at **+91 9286558531**.\n\nWe are available Monday to Saturday (10:00 AM – 8:00 PM IST) for custom sizing, order inquiries, and styling advice.`;
  } else {
    // Default search against catalog
    matchingProducts = parsedProducts.filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );

    if (matchingProducts.length > 0) {
      responseText = `I found ${matchingProducts.length} product(s) in our collection matching "${userMessage}":`;
    } else {
      matchingProducts = parsedProducts.slice(0, 2);
      responseText = `Welcome to Ilma Hijab Collection! How can I assist you today? I can help you choose the perfect abaya, track your order, or provide details about fabrics and sizing. Here are our current featured pieces:`;
    }
  }

  return {
    reply: responseText,
    products: matchingProducts.length > 0 ? matchingProducts : undefined,
  };
}
