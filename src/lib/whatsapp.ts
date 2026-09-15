const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_BUSINESS_PHONE = process.env.WHATSAPP_BUSINESS_PHONE;

export async function sendWhatsAppMessage(to: string, message: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("WhatsApp credentials not configured. Message not sent.");
    return;
  }

  let formattedTo = to.replace(/\D/g, "");
  if (formattedTo.length === 10) {
    formattedTo = "91" + formattedTo;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedTo,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to send WhatsApp message:", data);
    } else {
      console.log("WhatsApp message sent successfully");
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
  }
}

export async function sendCustomerConfirmation(order: any) {
  const amount = order.totalAmount || order.total || 0;
  const phone = order.customerWhatsapp || order.customerPhone;
  
  if (!phone) {
    console.warn("No phone number for customer notification");
    return;
  }

  const message = `Assalamu Alaikum ${order.customerName || 'Customer'} 🌙

Alhamdulillah, your order from Ilma Hijab Collection has been successfully confirmed.

Order ID: ${order.orderId}
Amount: ₹${amount.toLocaleString('en-IN')}

JazakAllahu Khairan for choosing Ilma Hijab Collection.

May Allah put Barakah in your purchase. 🤍

We will keep you updated regarding your order and delivery.

— Ilma Hijab Collection`;

  await sendWhatsAppMessage(phone, message);
}

export async function sendBusinessNotification(order: any) {
  if (!WHATSAPP_BUSINESS_PHONE) {
    console.warn("Business WhatsApp number not configured.");
    return;
  }

  const amount = order.totalAmount || order.total || 0;
  const itemsList = order.items?.map((item: any) => 
    `- ${item.name || item.product?.name || item.productId} (x${item.quantity}) - ${item.color || 'N/A'}, ${item.size || 'N/A'}`
  ).join('\n') || 'N/A';

  const address = [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.state,
    order.postalCode
  ].filter(Boolean).join(', ');

  const message = `🛍️ NEW ORDER — ILMA HIJAB COLLECTION

Order ID: ${order.orderId}
Customer: ${order.customerName}
Phone: ${order.customerPhone}
WhatsApp: ${order.customerWhatsapp || order.customerPhone}
Product(s):
${itemsList}
Total: ₹${amount.toLocaleString('en-IN')}
Payment: ${order.paymentStatus || 'PENDING'} (${order.paymentMethod || 'UNKNOWN'})
Address: ${address}

Please process the order.`;

  await sendWhatsAppMessage(WHATSAPP_BUSINESS_PHONE, message);
}
