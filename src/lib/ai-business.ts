import prisma from '@/lib/prisma';

export interface BusinessReportData {
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  periodStart: Date;
  periodEnd: Date;
  totalVisitors: number;
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  topProducts: Array<{ id: string; name: string; salesCount: number; revenue: number }>;
  lowStockProducts: Array<{ id: string; name: string; stock: number; price: number }>;
  customerInsights: string;
  aiRecommendations: string[];
  previousPeriod?: {
    revenue: number;
    orders: number;
    visitors: number;
    conversionRate: number;
  };
}

export async function generateBusinessReport(
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY'
): Promise<BusinessReportData> {
  const now = new Date();
  let periodStart = new Date();
  let prevPeriodStart = new Date();
  let prevPeriodEnd = new Date();

  if (type === 'DAILY') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    prevPeriodStart = new Date(periodStart.getTime() - 24 * 60 * 60 * 1000);
    prevPeriodEnd = new Date(periodStart);
  } else if (type === 'WEEKLY') {
    periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    prevPeriodStart = new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    prevPeriodEnd = new Date(periodStart);
  } else {
    // MONTHLY
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0);
    prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate(), 0, 0, 0);
    prevPeriodEnd = new Date(periodStart);
  }

  // 1. Current period orders
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: periodStart, lte: now } },
    include: { items: true },
  });

  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'COD');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // 2. Current period visitors
  const visitorSessions = await prisma.visitorSession.findMany({
    where: { createdAt: { gte: periodStart, lte: now } },
    select: { visitorId: true },
  });
  const totalVisitors = new Set(visitorSessions.map((v) => v.visitorId)).size;
  const conversionRate = totalVisitors > 0 ? Number(((totalOrders / totalVisitors) * 100).toFixed(1)) : 0;

  // 3. Previous period metrics for comparison
  const prevOrders = await prisma.order.findMany({
    where: { createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd } },
  });
  const prevPaidOrders = prevOrders.filter((o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'COD');
  const prevRevenue = prevPaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const prevVisitorSessions = await prisma.visitorSession.findMany({
    where: { createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd } },
    select: { visitorId: true },
  });
  const prevVisitors = new Set(prevVisitorSessions.map((v) => v.visitorId)).size;
  const prevConversionRate = prevVisitors > 0 ? Number(((prevOrders.length / prevVisitors) * 100).toFixed(1)) : 0;

  // 4. Product performance & low stock from REAL database
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, stock: true, originalPrice: true, salePrice: true },
  });

  const lowStockProducts = allProducts
    .filter((p) => p.stock <= 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      price: p.salePrice || p.originalPrice,
    }));

  // Aggregate product sales from current period order items
  const productSalesMap: Record<string, { id: string; name: string; salesCount: number; revenue: number }> = {};
  for (const o of orders) {
    for (const item of o.items) {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          id: item.productId,
          name: item.name,
          salesCount: 0,
          revenue: 0,
        };
      }
      productSalesMap[item.productId].salesCount += item.quantity;
      productSalesMap[item.productId].revenue += item.price * item.quantity;
    }
  }
  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 5);

  // 5. Customer insights from real CRM
  const totalCustomers = await prisma.customer.count();
  const vipCustomers = await prisma.customer.count({ where: { customerType: 'VIP' } });
  const returningCustomers = await prisma.customer.count({ where: { customerType: 'RETURNING' } });

  let customerInsights = `Customer base stands at ${totalCustomers} verified profiles. ${vipCustomers} customers are classified as VIPs (high lifetime spenders), while ${returningCustomers} have returned for repeat orders.`;
  if (totalCustomers === 0) {
    customerInsights = 'No customer profiles have completed checkout yet.';
  }

  // 6. Generate AI recommendations using OpenAI or Intelligent Real-Data Deterministic Engine
  let aiRecommendations: string[] = [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `You are the Ilma AI Business Manager for Ilma Hijab Collection (a luxury modest fashion/hijab brand).
Here is REAL verified store data for ${type} report:
- Total Visitors: ${totalVisitors}
- Total Orders: ${totalOrders}
- Total Revenue: INR ${totalRevenue}
- Conversion Rate: ${conversionRate}%
- Top Selling Products: ${topProducts.map((p) => `${p.name} (${p.salesCount} sold)`).join(', ') || 'None sold yet'}
- Low Stock Warnings: ${lowStockProducts.map((p) => `${p.name} (${p.stock} left)`).join(', ') || 'None'}
- Previous Period: Revenue INR ${prevRevenue}, Orders ${prevOrders.length}, Visitors ${prevVisitors}

Rules:
1. Ground all recommendations strictly in these real numbers. Do NOT invent numbers.
2. Return exactly a JSON object with two fields: "summary" (string), "recommendations" (array of 3-5 actionable strings).`;

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        const parsed = JSON.parse(aiJson.choices[0].message.content);
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          aiRecommendations = parsed.recommendations;
        }
        if (parsed.summary) {
          customerInsights = parsed.summary;
        }
      }
    } catch (e) {
      console.warn('OpenAI call failed, using deterministic analytical engine:', e);
    }
  }

  // Fallback to strict deterministic data-driven engine
  if (aiRecommendations.length === 0) {
    if (lowStockProducts.length > 0) {
      aiRecommendations.push(
        `Restock Alert: ${lowStockProducts.map((p) => `"${p.name}" (${p.stock} units left)`).join(', ')} to prevent lost sales.`
      );
    }

    if (totalOrders > 0 && topProducts.length > 0) {
      aiRecommendations.push(
        `Highlight Bestseller: Promote "${topProducts[0].name}" prominently on the homepage hero banner to maximize current momentum.`
      );
    }

    if (conversionRate < 2 && totalVisitors > 10) {
      aiRecommendations.push(
        `Conversion Optimization: Conversion is currently at ${conversionRate}%. Review checkout mobile flow and consider offering limited-time free shipping.`
      );
    } else if (conversionRate >= 3) {
      aiRecommendations.push(
        `Strong Conversion: Current conversion rate of ${conversionRate}% is outperforming industry average. Increase targeted Instagram ad spend to scale traffic.`
      );
    }

    if (totalVisitors === 0) {
      aiRecommendations.push(
        'Traffic Acceleration: Zero active customer sessions logged today. Share new catalog reels on Instagram and WhatsApp broadcast groups.'
      );
    }

    if (aiRecommendations.length === 0) {
      aiRecommendations.push(
        'Inventory is healthy and order processing is up to date. Monitor real-time visitor traffic to track ongoing promotion performance.'
      );
    }
  }

  const reportData: BusinessReportData = {
    reportType: type,
    periodStart,
    periodEnd: now,
    totalVisitors,
    totalOrders,
    totalRevenue,
    conversionRate,
    topProducts,
    lowStockProducts,
    customerInsights,
    aiRecommendations,
    previousPeriod: {
      revenue: prevRevenue,
      orders: prevOrders.length,
      visitors: prevVisitors,
      conversionRate: prevConversionRate,
    },
  };

  // Persist report in database
  try {
    await prisma.aiReport.create({
      data: {
        reportType: type,
        periodStart,
        periodEnd: now,
        totalVisitors,
        totalOrders,
        totalRevenue,
        conversionRate,
        topProducts: JSON.stringify(topProducts),
        lowStockProducts: JSON.stringify(lowStockProducts),
        customerInsights,
        aiRecommendations: JSON.stringify(aiRecommendations),
      },
    });
  } catch (err) {
    console.warn('Failed to persist AiReport:', err);
  }

  return reportData;
}
