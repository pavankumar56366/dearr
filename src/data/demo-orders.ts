/**
 * Dearr V1 Demo Orders Data
 *
 * Local demo data for Customer Account Order History (Task C-14).
 * Reuses the existing DemoOrder & DemoOrderItem types from src/lib/order-model.ts.
 * References actual products from src/data/sample-products.ts for images and names.
 *
 * Maps to future MySQL tables:
 * - orders (docs/5.SCHEMA(1).md §2.14)
 * - order_items (docs/5.SCHEMA(1).md §2.15)
 * - payments (docs/5.SCHEMA(1).md §2.16)
 */

import type { DemoOrder } from "@/lib/order-model";
import { adminOrderToDemoOrder } from "@/lib/order-model";
export { adminOrderToDemoOrder };
import { getAdminOrderById, getAllAdminOrders } from "@/lib/admin-orders";

/**
 * Extended order status type for history display.
 * The DemoOrder type uses a union; we map these to the 3D printing production stages.
 */
export type OrderFulfillmentStage =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

/**
 * Pre-built demo orders using real product images from public/product-samples/
 * These simulate a customer's order history with various statuses.
 */
export const DEMO_ORDERS: DemoOrder[] = [
  {
    id: "order_demo_001",
    orderNumber: "DEAR-10042",
    status: "delivered",
    paymentStatus: "paid",
    paymentMethod: "Razorpay (Prepaid Online)",
    subtotal: 1248,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 1248,
    currency: "INR",
    shippingFullName: "Pavan Kumar",
    shippingPhone: "+91 98765 43210",
    shippingEmail: "pavan@dearr.in",
    shippingAddressLine1: "42, Creative Lane, Ameerpet",
    shippingAddressLine2: "Near Metro Station, Landmark Tower",
    shippingCity: "Hyderabad",
    shippingState: "Telangana",
    shippingPostalCode: "500038",
    shippingCountry: "India",
    createdAt: "2025-08-12T14:25:00.000Z",
    items: [
      {
        id: "item_demo_001_1",
        productId: "sp-01",
        productName: "3D Printed Radha Krishna Figurine (12.5 cm)",
        slug: "3d-printed-radha-krishna-figurine-12-5cm",
        image: "/product-samples/1.jpeg",
        unitPrice: 699,
        quantity: 1,
        discountAmount: 0,
        lineTotal: 699,
      },
      {
        id: "item_demo_001_2",
        productId: "sp-02",
        productName: "3D Printed Golden Ganesha Idol",
        slug: "3d-printed-golden-ganesha-idol",
        image: "/product-samples/2.jpeg",
        unitPrice: 549,
        quantity: 1,
        discountAmount: 0,
        lineTotal: 549,
      },
    ],
  },
  {
    id: "order_demo_002",
    orderNumber: "DEAR-10078",
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "Razorpay (Prepaid Online)",
    subtotal: 1097,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 1097,
    currency: "INR",
    shippingFullName: "Pavan Kumar",
    shippingPhone: "+91 98765 43210",
    shippingEmail: "pavan@dearr.in",
    shippingAddressLine1: "42, Creative Lane, Ameerpet",
    shippingAddressLine2: "Near Metro Station, Landmark Tower",
    shippingCity: "Hyderabad",
    shippingState: "Telangana",
    shippingPostalCode: "500038",
    shippingCountry: "India",
    createdAt: "2025-09-22T09:15:00.000Z",
    items: [
      {
        id: "item_demo_002_1",
        productId: "sp-06",
        productName: "Customized 3D Printed Car Model Keychain",
        slug: "customized-3d-printed-car-model-keychain",
        image: "/product-samples/6.jpeg",
        unitPrice: 299,
        quantity: 2,
        discountAmount: 0,
        lineTotal: 598,
      },
      {
        id: "item_demo_002_2",
        productId: "sp-03",
        productName: "Modern Minimalist Ganesha with Veena Sculpture",
        slug: "modern-minimalist-ganesha-veena-sculpture",
        image: "/product-samples/3.jpeg",
        unitPrice: 499,
        quantity: 1,
        discountAmount: 0,
        lineTotal: 499,
      },
    ],
  },
  {
    id: "order_demo_003",
    orderNumber: "DEAR-10115",
    status: "shipped",
    paymentStatus: "paid",
    paymentMethod: "Razorpay (Prepaid Online)",
    subtotal: 799,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 799,
    currency: "INR",
    shippingFullName: "Pavan Kumar",
    shippingPhone: "+91 98765 43210",
    shippingEmail: "pavan@dearr.in",
    shippingAddressLine1: "5th Floor, Tech Hub, Madhapur",
    shippingCity: "Hyderabad",
    shippingState: "Telangana",
    shippingPostalCode: "500081",
    shippingCountry: "India",
    createdAt: "2025-09-28T16:40:00.000Z",
    items: [
      {
        id: "item_demo_003_1",
        productId: "sp-07",
        productName: "3D Printed Lithophane Night Light Lamp",
        slug: "3d-printed-lithophane-night-light-lamp",
        image: "/product-samples/7.jpeg",
        unitPrice: 799,
        quantity: 1,
        discountAmount: 0,
        lineTotal: 799,
      },
    ],
  },
  {
    id: "order_demo_004",
    orderNumber: "DEAR-10003",
    status: "confirmed",
    paymentStatus: "simulated",
    paymentMethod: "Razorpay (Prepaid Online)",
    subtotal: 798,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 798,
    currency: "INR",
    shippingFullName: "Pavan Kumar",
    shippingPhone: "+91 98765 43210",
    shippingEmail: "pavan@dearr.in",
    shippingAddressLine1: "42, Creative Lane, Ameerpet",
    shippingAddressLine2: "Near Metro Station, Landmark Tower",
    shippingCity: "Hyderabad",
    shippingState: "Telangana",
    shippingPostalCode: "500038",
    shippingCountry: "India",
    createdAt: "2025-09-30T06:10:00.000Z",
    items: [
      {
        id: "item_demo_004_1",
        productId: "sp-05",
        productName: "3D Printed Articulated Heart Character",
        slug: "3d-printed-articulated-heart-character",
        image: "/product-samples/5.jpeg",
        unitPrice: 399,
        quantity: 1,
        discountAmount: 0,
        lineTotal: 399,
      },
      {
        id: "item_demo_004_2",
        productId: "sp-09",
        productName: "3D Printed Hoodie Pen Holder & Desk Organizer",
        slug: "3d-printed-hoodie-pen-holder-desk-organizer",
        image: "/product-samples/9.jpeg",
        unitPrice: 399,
        quantity: 1,
        discountAmount: 0,
        lineTotal: 399,
      },
    ],
  },
];

/**
 * Find an order by its customer-facing order number.
 * Searches static DEMO_ORDERS and then dearr_admin_orders session catalog.
 */
export function getDemoOrderByNumber(orderNumber: string): DemoOrder | null {
  const norm = orderNumber.trim().toUpperCase();
  const staticFound = DEMO_ORDERS.find(
    (o) => o.orderNumber.toUpperCase() === norm
  );
  if (staticFound) return staticFound;

  if (typeof window !== "undefined") {
    const adminOrder = getAdminOrderById(norm);
    if (adminOrder) {
      return adminOrderToDemoOrder(adminOrder);
    }
  }

  return null;
}

/**
 * Retrieve all customer-visible orders, merging DEMO_ORDERS with session-placed orders.
 */
export function getAllCustomerOrders(): DemoOrder[] {
  if (typeof window === "undefined") return DEMO_ORDERS;
  const adminOrders = getAllAdminOrders();
  if (adminOrders.length === 0) return DEMO_ORDERS;
  return adminOrders.map(adminOrderToDemoOrder);
}

/**
 * Get a display-friendly status label for the order fulfillment stage.
 */
export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Order Received (Pending)",
    confirmed: "Order Confirmed",
    processing: "3D Print in Progress",
    shipped: "Packed & Dispatched",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

/**
 * Get a Tailwind-compatible color config for a given order status.
 */
export function getOrderStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case "delivered":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        border: "border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "shipped":
      return {
        bg: "bg-blue-50",
        text: "text-blue-800",
        border: "border-blue-200",
        dot: "bg-blue-500",
      };
    case "processing":
      return {
        bg: "bg-purple-50",
        text: "text-purple-800",
        border: "border-purple-200",
        dot: "bg-purple-500",
      };
    case "confirmed":
      return {
        bg: "bg-blue-50",
        text: "text-blue-900",
        border: "border-blue-200",
        dot: "bg-blue-500",
      };
    case "pending":
      return {
        bg: "bg-amber-50",
        text: "text-amber-800",
        border: "border-amber-200",
        dot: "bg-amber-500",
      };
    case "cancelled":
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
        dot: "bg-red-500",
      };
    default:
      return {
        bg: "bg-neutral-100",
        text: "text-neutral-700",
        border: "border-neutral-200",
        dot: "bg-neutral-400",
      };
  }
}
