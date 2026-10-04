import type { CartItem } from "@/context/CartContext";
import type { DeliveryAddressFormValues } from "./checkout-validation";
import {
  type AdminOrder,
  getAllAdminOrders,
  saveAdminOrder,
  generateUniqueOrderNumber,
} from "./admin-orders";

/**
 * DemoOrderItem — Snapshot of a purchased item.
 * Maps to future MySQL order_items table (docs/5.SCHEMA(1).md §2.15).
 */
export interface DemoOrderItem {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  variantId?: string;
  variantName?: string;
  image: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  lineTotal: number;
}

/**
 * DemoOrder — Customer order snapshot.
 * Maps to future MySQL orders & payments tables (docs/5.SCHEMA(1).md §2.14 & §2.16).
 */
export interface DemoOrder {
  id: string;
  orderNumber: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "paid" | "simulated" | "pending" | "refunded" | "failed";
  paymentMethod: string;
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: "INR";
  shippingFullName: string;
  shippingPhone: string;
  shippingEmail: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  createdAt: string;
  items: DemoOrderItem[];
}

/**
 * Legacy key alias preserved for backwards compatibility.
 * All orders are persisted in `dearr_admin_orders`.
 */
export const DEMO_ORDER_SESSION_KEY = "dearr_admin_orders";

/**
 * Convert an AdminOrder to a customer DemoOrder representation
 */
export function adminOrderToDemoOrder(order: AdminOrder): DemoOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.orderStatus,
    paymentStatus: order.paymentStatus === "paid" ? "paid" : "pending",
    paymentMethod: order.paymentMethod || "Razorpay (Prepaid Online)",
    subtotal: order.subtotal,
    shippingAmount: order.shippingAmount,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    currency: order.currency,
    shippingFullName: order.shippingAddress.fullName || order.customer.name,
    shippingPhone: order.shippingAddress.phone || order.customer.phone,
    shippingEmail: order.customer.email,
    shippingAddressLine1: order.shippingAddress.addressLine1,
    shippingAddressLine2: order.shippingAddress.addressLine2,
    shippingCity: order.shippingAddress.city,
    shippingState: order.shippingAddress.state,
    shippingPostalCode: order.shippingAddress.postalCode,
    shippingCountry: order.shippingAddress.country,
    createdAt: order.createdAt,
    items: order.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.name,
      slug: it.slug,
      variantName: it.variantName,
      image: it.image,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      discountAmount: 0,
      lineTotal: it.lineTotal,
    })),
  };
}

/**
 * Convert a DemoOrder to an AdminOrder representation
 */
export function demoOrderToAdminOrder(order: DemoOrder): AdminOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: {
      name: order.shippingFullName,
      email: order.shippingEmail,
      phone: order.shippingPhone,
    },
    items: order.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.productName,
      slug: it.slug,
      image: it.image,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      lineTotal: it.lineTotal,
      variantName: it.variantName,
    })),
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    shippingAmount: order.shippingAmount,
    totalAmount: order.totalAmount,
    currency: "INR",
    paymentStatus: order.paymentStatus === "paid" ? "paid" : "pending",
    orderStatus: order.status,
    paymentMethod: order.paymentMethod,
    shippingAddress: {
      fullName: order.shippingFullName,
      phone: order.shippingPhone,
      addressLine1: order.shippingAddressLine1,
      addressLine2: order.shippingAddressLine2,
      city: order.shippingCity,
      state: order.shippingState,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  };
}

/**
 * Generate a customer-facing order reference in format DEAR-XXXXX
 */
export function generateDemoOrderNumber(): string {
  return generateUniqueOrderNumber();
}

/**
 * Factory to build a clean DemoOrder snapshot from checkout data
 */
export function createDemoOrderFromCheckout(
  items: CartItem[],
  address: DeliveryAddressFormValues,
  subtotal: number,
  orderNumberOverride?: string
): DemoOrder {
  const orderNumber = orderNumberOverride || generateDemoOrderNumber();
  const orderId = `order_${Date.now()}`;

  const orderItems: DemoOrderItem[] = items.map((item, index) => ({
    id: `item_${Date.now()}_${index}`,
    productId: item.productId,
    productName: item.name,
    slug: item.slug,
    variantId: item.variantId,
    variantName: item.variantName,
    image: item.image,
    unitPrice: item.price,
    quantity: item.quantity,
    discountAmount: 0,
    lineTotal: item.price * item.quantity,
  }));

  return {
    id: orderId,
    orderNumber,
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "Razorpay (Prepaid Demo)",
    subtotal,
    shippingAmount: 0, // Free Standard 3D Print Logistics
    discountAmount: 0,
    totalAmount: subtotal,
    currency: "INR",
    shippingFullName: address.fullName,
    shippingPhone: address.phone,
    shippingEmail: address.email,
    shippingAddressLine1: address.addressLine1,
    shippingAddressLine2: address.addressLine2,
    shippingCity: address.city,
    shippingState: address.state,
    shippingPostalCode: address.postalCode,
    shippingCountry: address.country || "India",
    createdAt: new Date().toISOString(),
    items: orderItems,
  };
}

/**
 * Single source of truth session storage persistence for orders.
 * Routes directly to `saveAdminOrder` under `dearr_admin_orders`.
 */
export function saveDemoOrderToSession(order: DemoOrder): void {
  saveAdminOrder(demoOrderToAdminOrder(order));
}

/**
 * Retrieve the latest demo order from `dearr_admin_orders`.
 */
export function getDemoOrderFromSession(): DemoOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const all = getAllAdminOrders();
    if (all.length > 0) {
      return adminOrderToDemoOrder(all[0]);
    }
    return null;
  } catch (e) {
    console.warn("Unable to parse demo order from sessionStorage", e);
    return null;
  }
}

export function clearDemoOrderFromSession(): void {
  // Demo orders are part of the admin session catalog; preserved per requirements
}
