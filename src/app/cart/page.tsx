import type { Metadata } from "next";
import { CartPageClient } from "@/components/customer/cart";

/**
 * Customer Cart Page
 * Route: /cart
 * Design Ref: docs/4.DESIGN(1) (1).md §6.4 (Cart & Checkout)
 * Flow Ref: docs/3.APPFLOW(1).md §4.6 (Cart Management)
 */
export const metadata: Metadata = {
  title: "Shopping Cart — Dearr | 3D Printed Products",
  description:
    "Review your precision 3D printed items, adjust quantities, and proceed to checkout.",
};

export default function CartPage() {
  return <CartPageClient />;
}
