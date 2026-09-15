import Razorpay from "razorpay";
import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET 
  ? new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    }) 
  : null;

export async function createRazorpayOrder(amount: number, orderId: string) {
  if (!razorpay) {
    console.warn("Razorpay credentials not configured.");
    return null;
  }

  try {
    const options = {
      amount: Math.round(amount * 100), // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: orderId,
    };
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return null;
  }
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  if (!RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay key secret not configured.");
    return false;
  }

  try {
    const text = orderId + "|" + paymentId;
    const generated_signature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    return generated_signature === signature;
  } catch (error) {
    console.error("Error verifying payment signature:", error);
    return false;
  }
}
