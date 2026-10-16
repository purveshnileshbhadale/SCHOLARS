import { RAZORPAY_KEY_ID } from "./supabase";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export interface CheckoutArgs {
  orderId: string;
  amountInr: number;
  name: string;
  prefill: { name?: string; email?: string; contact?: string };
  onSuccess: (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onDismiss: () => void;
}

export async function openCheckout(args: CheckoutArgs): Promise<void> {
  await loadRazorpay();
  if (!window.Razorpay) throw new Error("Razorpay checkout unavailable.");
  if (!RAZORPAY_KEY_ID) throw new Error("Missing VITE_RAZORPAY_KEY_ID.");
  const rzp = new window.Razorpay({
    key: RAZORPAY_KEY_ID,
    order_id: args.orderId,
    amount: Math.round(args.amountInr * 100),
    currency: "INR",
    name: "Scholars Abroad",
    description: `Counselling — ${args.name}`,
    prefill: args.prefill,
    theme: { color: "#047857" },
    handler: args.onSuccess,
    modal: { ondismiss: args.onDismiss },
  });
  rzp.open();
}
