/**
 * Dearr V1 Admin Orders Domain Model & Session Storage
 *
 * Source of Truth for Dearr Founder/Admin Orders Management (Task A-13).
 * Represents orders placed on the storefront, tracking customer details,
 * 3D printing fulfillment stages, line items, and payment reconciliation.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  variantName?: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: "INR";
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentMethod?: string;
  shippingAddress: ShippingAddress;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  discountCode?: string;
  notes?: string;
}

export interface OrderMetrics {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
}

/**
 * Realistic Base Demo Orders for Dearr 3D Printing Store
 */
export const BASE_ORDERS: AdminOrder[] = [
  {
    id: "ord_dearr_001",
    orderNumber: "DEAR-84021",
    customer: {
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      phone: "+91 98201 54321",
    },
    items: [
      {
        id: "item_001_1",
        productId: "sp-01",
        name: "3D Printed Radha Krishna Figurine (12.5 cm)",
        slug: "3d-printed-radha-krishna-figurine-12-5cm",
        image: "/product-samples/1.jpeg",
        unitPrice: 699,
        quantity: 1,
        lineTotal: 699,
      },
      {
        id: "item_001_2",
        productId: "sp-02",
        name: "3D Printed Golden Ganesha Idol",
        slug: "3d-printed-golden-ganesha-idol",
        image: "/product-samples/2.jpeg",
        unitPrice: 549,
        quantity: 1,
        lineTotal: 549,
      },
    ],
    subtotal: 1248,
    discountAmount: 0,
    shippingAmount: 0,
    totalAmount: 1248,
    currency: "INR",
    paymentStatus: "paid",
    orderStatus: "delivered",
    paymentMethod: "Razorpay UPI",
    shippingAddress: {
      fullName: "Aarav Sharma",
      phone: "+91 98201 54321",
      addressLine1: "Flat 402, Green Meadows, Lokhandwala",
      addressLine2: "Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400053",
      country: "India",
    },
    createdAt: "2026-09-24T11:20:00.000Z",
    updatedAt: "2026-09-27T16:45:00.000Z",
  },
  {
    id: "ord_dearr_002",
    orderNumber: "DEAR-84022",
    customer: {
      name: "Priya Patel",
      email: "priya.patel@example.com",
      phone: "+91 99042 12345",
    },
    items: [
      {
        id: "item_002_1",
        productId: "sp-03",
        name: "Modern Minimalist Ganesha Sculpture",
        slug: "modern-minimalist-ganesha-veena-sculpture",
        image: "/product-samples/3.jpeg",
        unitPrice: 849,
        quantity: 1,
        lineTotal: 849,
      },
    ],
    subtotal: 849,
    discountAmount: 85,
    shippingAmount: 0,
    totalAmount: 764,
    currency: "INR",
    paymentStatus: "paid",
    orderStatus: "processing",
    discountCode: "DEARR10",
    paymentMethod: "Razorpay Netbanking",
    shippingAddress: {
      fullName: "Priya Patel",
      phone: "+91 99042 12345",
      addressLine1: "12, Shanti Niketan Society, Satellite",
      city: "Ahmedabad",
      state: "Gujarat",
      postalCode: "380015",
      country: "India",
    },
    createdAt: "2026-09-28T14:30:00.000Z",
    updatedAt: "2026-09-29T10:15:00.000Z",
  },
  {
    id: "ord_dearr_003",
    orderNumber: "DEAR-84023",
    customer: {
      name: "Rohan Verma",
      email: "rohan.verma@example.com",
      phone: "+91 98110 98765",
    },
    items: [
      {
        id: "item_003_1",
        productId: "sp-07",
        name: "Articulated Winged Dragon (30cm)",
        slug: "articulated-winged-dragon-30cm",
        image: "/product-samples/7.jpeg",
        unitPrice: 1499,
        quantity: 1,
        lineTotal: 1499,
        variantName: "Dual Color Silk (Emerald/Gold)",
      },
    ],
    subtotal: 1499,
    discountAmount: 0,
    shippingAmount: 0,
    totalAmount: 1499,
    currency: "INR",
    paymentStatus: "paid",
    orderStatus: "shipped",
    paymentMethod: "Razorpay Cards",
    shippingAddress: {
      fullName: "Rohan Verma",
      phone: "+91 98110 98765",
      addressLine1: "B-204, Pinnacle Heights, Sector 62",
      city: "Noida",
      state: "Uttar Pradesh",
      postalCode: "201309",
      country: "India",
    },
    createdAt: "2026-09-27T08:45:00.000Z",
    updatedAt: "2026-09-29T18:20:00.000Z",
  },
  {
    id: "ord_dearr_004",
    orderNumber: "DEAR-84024",
    customer: {
      name: "Ananya Iyer",
      email: "ananya.iyer@example.com",
      phone: "+91 94440 33221",
    },
    items: [
      {
        id: "item_004_1",
        productId: "sp-04",
        name: "Geometric Spiral Succulent Planter",
        slug: "geometric-spiral-succulent-planter",
        image: "/product-samples/4.jpeg",
        unitPrice: 449,
        quantity: 1,
        lineTotal: 449,
      },
    ],
    subtotal: 449,
    discountAmount: 0,
    shippingAmount: 50,
    totalAmount: 499,
    currency: "INR",
    paymentStatus: "paid",
    orderStatus: "confirmed",
    paymentMethod: "Razorpay UPI",
    shippingAddress: {
      fullName: "Ananya Iyer",
      phone: "+91 94440 33221",
      addressLine1: "No. 8, Karpagam Avenue, R.A. Puram",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600028",
      country: "India",
    },
    createdAt: "2026-09-29T19:10:00.000Z",
    updatedAt: "2026-09-29T19:12:00.000Z",
  },
  {
    id: "ord_dearr_005",
    orderNumber: "DEAR-84025",
    customer: {
      name: "Vikram Malhotra",
      email: "vikram.m@example.com",
      phone: "+91 98712 34567",
    },
    items: [
      {
        id: "item_005_1",
        productId: "sp-05",
        name: "Meditative Buddha Head Bust (15cm)",
        slug: "meditative-buddha-head-bust-15cm",
        image: "/product-samples/5.jpeg",
        unitPrice: 899,
        quantity: 1,
        lineTotal: 899,
      },
    ],
    subtotal: 899,
    discountAmount: 0,
    shippingAmount: 0,
    totalAmount: 899,
    currency: "INR",
    paymentStatus: "pending",
    orderStatus: "pending",
    paymentMethod: "Razorpay (Awaiting Gateway Response)",
    shippingAddress: {
      fullName: "Vikram Malhotra",
      phone: "+91 98712 34567",
      addressLine1: "House 14, Golf Links",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110003",
      country: "India",
    },
    createdAt: "2026-09-30T07:30:00.000Z",
    updatedAt: "2026-09-30T07:30:00.000Z",
  },
  {
    id: "ord_dearr_006",
    orderNumber: "DEAR-84026",
    customer: {
      name: "Sneha Reddy",
      email: "sneha.reddy@example.com",
      phone: "+91 98490 87654",
    },
    items: [
      {
        id: "item_006_1",
        productId: "sp-06",
        name: "Lord Shiva in Deep Meditation Statue",
        slug: "lord-shiva-in-deep-meditation-statue",
        image: "/product-samples/6.jpeg",
        unitPrice: 1199,
        quantity: 1,
        lineTotal: 1199,
      },
    ],
    subtotal: 1199,
    discountAmount: 200,
    shippingAmount: 0,
    totalAmount: 999,
    currency: "INR",
    paymentStatus: "paid",
    orderStatus: "processing",
    discountCode: "WELCOME200",
    paymentMethod: "Razorpay UPI",
    shippingAddress: {
      fullName: "Sneha Reddy",
      phone: "+91 98490 87654",
      addressLine1: "Villa 22, Whisper Valley, Jubilee Hills",
      city: "Hyderabad",
      state: "Telangana",
      postalCode: "500033",
      country: "India",
    },
    createdAt: "2026-09-30T09:40:00.000Z",
    updatedAt: "2026-09-30T10:05:00.000Z",
  },
  {
    id: "ord_dearr_007",
    orderNumber: "DEAR-84027",
    customer: {
      name: "Kavita Rao",
      email: "kavita.rao@example.com",
      phone: "+91 97411 22334",
    },
    items: [
      {
        id: "item_007_1",
        productId: "sp-08",
        name: "Custom Spotify Code Keychain",
        slug: "custom-spotify-code-keychain",
        image: "/product-samples/8.jpeg",
        unitPrice: 199,
        quantity: 2,
        lineTotal: 398,
      },
    ],
    subtotal: 398,
    discountAmount: 0,
    shippingAmount: 60,
    totalAmount: 458,
    currency: "INR",
    paymentStatus: "paid",
    orderStatus: "delivered",
    paymentMethod: "Razorpay Cards",
    shippingAddress: {
      fullName: "Kavita Rao",
      phone: "+91 97411 22334",
      addressLine1: "301, Brigade Orchards, Devanahalli",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "562110",
      country: "India",
    },
    createdAt: "2026-09-18T16:20:00.000Z",
    updatedAt: "2026-09-22T14:10:00.000Z",
  },
  {
    id: "ord_dearr_008",
    orderNumber: "DEAR-84028",
    customer: {
      name: "Arjun Nair",
      email: "arjun.nair@example.com",
      phone: "+91 98950 44556",
    },
    items: [
      {
        id: "item_008_1",
        productId: "sp-09",
        name: "Cyberpunk Desk Cable Organizer",
        slug: "cyberpunk-desk-cable-organizer",
        image: "/product-samples/9.jpeg",
        unitPrice: 349,
        quantity: 1,
        lineTotal: 349,
      },
    ],
    subtotal: 349,
    discountAmount: 0,
    shippingAmount: 50,
    totalAmount: 399,
    currency: "INR",
    paymentStatus: "refunded",
    orderStatus: "cancelled",
    paymentMethod: "Razorpay Netbanking",
    notes: "Customer cancelled prior to print queue allocation.",
    shippingAddress: {
      fullName: "Arjun Nair",
      phone: "+91 98950 44556",
      addressLine1: "Panampilly Nagar, 5th Cross Road",
      city: "Kochi",
      state: "Kerala",
      postalCode: "682036",
      country: "India",
    },
    createdAt: "2026-09-20T12:00:00.000Z",
    updatedAt: "2026-09-21T09:30:00.000Z",
  },
  {
    id: "ord_dearr_009",
    orderNumber: "DEAR-84029",
    customer: {
      name: "Meera Joshi",
      email: "meera.joshi@example.com",
      phone: "+91 98220 77889",
    },
    items: [
      {
        id: "item_009_1",
        productId: "sp-10",
        name: "Articulated Crystal Dragon (25cm)",
        slug: "articulated-crystal-dragon-25cm",
        image: "/product-samples/10.jpeg",
        unitPrice: 1199,
        quantity: 1,
        lineTotal: 1199,
      },
    ],
    subtotal: 1199,
    discountAmount: 0,
    shippingAmount: 0,
    totalAmount: 1199,
    currency: "INR",
    paymentStatus: "failed",
    orderStatus: "pending",
    paymentMethod: "Razorpay UPI",
    notes: "Payment session interrupted by user bank server error.",
    shippingAddress: {
      fullName: "Meera Joshi",
      phone: "+91 98220 77889",
      addressLine1: "74, Prabhat Road, Lane 10",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411004",
      country: "India",
    },
    createdAt: "2026-09-30T15:10:00.000Z",
    updatedAt: "2026-09-30T15:15:00.000Z",
  },
  {
    id: "ord_dearr_010",
    orderNumber: "DEAR-84030",
    customer: {
      name: "Aditya Sen",
      email: "aditya.sen@example.com",
      phone: "+91 98300 11223",
    },
    items: [
      {
        id: "item_010_1",
        productId: "sp-11",
        name: "Hanuman Chalisa Relief Wall Plaque",
        slug: "hanuman-chalisa-relief-wall-plaque",
        image: "/product-samples/11.jpeg",
        unitPrice: 1299,
        quantity: 1,
        lineTotal: 1299,
      },
    ],
    subtotal: 1299,
    discountAmount: 0,
    shippingAmount: 0,
    totalAmount: 1299,
    currency: "INR",
    paymentStatus: "paid",
    orderStatus: "delivered",
    paymentMethod: "Razorpay Cards",
    shippingAddress: {
      fullName: "Aditya Sen",
      phone: "+91 98300 11223",
      addressLine1: "Block C, Salt Lake City, Sector 1",
      city: "Kolkata",
      state: "West Bengal",
      postalCode: "700064",
      country: "India",
    },
    createdAt: "2026-09-15T10:00:00.000Z",
    updatedAt: "2026-09-19T13:40:00.000Z",
  },
];

const STORAGE_KEY_ORDERS = "dearr_admin_orders";

function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value || typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Retrieve all admin orders from sessionStorage, falling back to BASE_ORDERS.
 */
export function getAllAdminOrders(): AdminOrder[] {
  let orders: AdminOrder[] = [...BASE_ORDERS];

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_ORDERS);
      if (stored) {
        const parsed = safeParseJSON<AdminOrder[]>(stored, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          orders = parsed;
        }
      }
    } catch (err) {
      console.warn("Failed to read admin orders from session:", err);
    }
  }

  return orders;
}

/**
 * Find an admin order by ID or order number (case-insensitive).
 */
export function getAdminOrderById(idOrNumber: string): AdminOrder | null {
  const all = getAllAdminOrders();
  const normalized = idOrNumber.trim().toUpperCase();
  return (
    all.find(
      (o) =>
        o.id.toUpperCase() === normalized ||
        o.orderNumber.toUpperCase() === normalized
    ) || null
  );
}

/**
 * Persist or update an order into sessionStorage.
 */
export function saveAdminOrder(order: AdminOrder): void {
  if (typeof window === "undefined") return;

  try {
    const current = getAllAdminOrders();
    const exists = current.some((o) => o.id === order.id || o.orderNumber === order.orderNumber);

    let updated: AdminOrder[];
    if (exists) {
      updated = current.map((o) =>
        o.id === order.id || o.orderNumber === order.orderNumber
          ? { ...order, updatedAt: new Date().toISOString() }
          : o
      );
    } else {
      updated = [
        {
          ...order,
          createdAt: order.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ];
    }

    sessionStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save admin order:", err);
  }
}

/**
 * Update order fulfillment status.
 */
export function updateAdminOrderStatus(
  idOrNumber: string,
  status: OrderStatus
): AdminOrder | null {
  if (typeof window === "undefined") return null;

  try {
    const current = getAllAdminOrders();
    const normalized = idOrNumber.trim().toUpperCase();
    const index = current.findIndex(
      (o) =>
        o.id.toUpperCase() === normalized ||
        o.orderNumber.toUpperCase() === normalized
    );

    if (index === -1) return null;

    const existing = current[index];
    const updatedOrder: AdminOrder = {
      ...existing,
      orderStatus: status,
      updatedAt: new Date().toISOString(),
    };

    current[index] = updatedOrder;
    sessionStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(current));
    return updatedOrder;
  } catch (err) {
    console.warn("Failed to update admin order status:", err);
    return null;
  }
}

/**
 * Update order payment reconciliation status.
 */
export function updateAdminPaymentStatus(
  idOrNumber: string,
  paymentStatus: PaymentStatus
): AdminOrder | null {
  if (typeof window === "undefined") return null;

  try {
    const current = getAllAdminOrders();
    const normalized = idOrNumber.trim().toUpperCase();
    const index = current.findIndex(
      (o) =>
        o.id.toUpperCase() === normalized ||
        o.orderNumber.toUpperCase() === normalized
    );

    if (index === -1) return null;

    const existing = current[index];
    const updatedOrder: AdminOrder = {
      ...existing,
      paymentStatus,
      updatedAt: new Date().toISOString(),
    };

    current[index] = updatedOrder;
    sessionStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(current));
    return updatedOrder;
  } catch (err) {
    console.warn("Failed to update admin order payment status:", err);
    return null;
  }
}

/**
 * Calculate dynamic operational metrics across all orders.
 */
export function getOrderMetrics(orders: AdminOrder[]): OrderMetrics {
  let pending = 0;
  let processing = 0;
  let delivered = 0;
  let cancelled = 0;
  let totalRevenue = 0;

  for (const o of orders) {
    if (o.orderStatus === "pending") pending++;
    else if (o.orderStatus === "processing") processing++;
    else if (o.orderStatus === "delivered") delivered++;
    else if (o.orderStatus === "cancelled") cancelled++;

    // Total revenue is recognized from paid orders that are not cancelled
    if (o.paymentStatus === "paid" && o.orderStatus !== "cancelled") {
      totalRevenue += o.totalAmount;
    }
  }

  return {
    totalOrders: orders.length,
    pendingOrders: pending,
    processingOrders: processing,
    deliveredOrders: delivered,
    cancelledOrders: cancelled,
    totalRevenue,
  };
}

/**
 * Generate a unique human-facing order reference in format DEAR-XXXXX
 * ensuring no collisions with any existing demo or placed orders.
 */
export function generateUniqueOrderNumber(): string {
  const existingOrders = getAllAdminOrders();
  const existingNumbers = new Set(
    existingOrders.map((o) => o.orderNumber.toUpperCase())
  );

  let candidate = "";
  let attempts = 0;
  do {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    candidate = `DEAR-${randomSuffix}`;
    attempts++;
  } while (existingNumbers.has(candidate) && attempts < 100);

  return candidate;
}

export interface CreateOrderCheckoutPayload {
  items: {
    productId: string;
    name: string;
    slug: string;
    image: string;
    price: number;
    quantity: number;
    variantName?: string;
  }[];
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  subtotal: number;
  discountAmount?: number;
  discountCode?: string;
  shippingAmount?: number;
  paymentMethod?: string;
}

/**
 * Create an AdminOrder compatible with the admin domain model
 * from storefront checkout inputs.
 */
export function createAdminOrderFromCheckout(
  payload: CreateOrderCheckoutPayload
): AdminOrder {
  const orderNumber = generateUniqueOrderNumber();
  const id = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const discountAmount = Math.max(0, payload.discountAmount || 0);
  const shippingAmount = Math.max(0, payload.shippingAmount || 0);
  const totalAmount = Math.max(
    0,
    payload.subtotal - discountAmount + shippingAmount
  );

  const orderItems: OrderItem[] = payload.items.map((it, idx) => ({
    id: `item_${Date.now()}_${idx}`,
    productId: it.productId,
    name: it.name,
    slug: it.slug,
    image: it.image,
    unitPrice: it.price,
    quantity: it.quantity,
    lineTotal: it.price * it.quantity,
    variantName: it.variantName,
  }));

  return {
    id,
    orderNumber,
    customer: {
      name: payload.customer.name.trim(),
      email: payload.customer.email.trim(),
      phone: payload.customer.phone.trim(),
    },
    items: orderItems,
    subtotal: payload.subtotal,
    discountAmount,
    shippingAmount,
    totalAmount,
    currency: "INR",
    paymentStatus: "pending",
    orderStatus: "pending",
    paymentMethod: payload.paymentMethod || "Razorpay (Prepaid Demo)",
    shippingAddress: {
      fullName: payload.shippingAddress.fullName.trim(),
      phone: payload.shippingAddress.phone.trim(),
      addressLine1: payload.shippingAddress.addressLine1.trim(),
      addressLine2: payload.shippingAddress.addressLine2?.trim() || undefined,
      city: payload.shippingAddress.city.trim(),
      state: payload.shippingAddress.state.trim(),
      postalCode: payload.shippingAddress.postalCode.trim(),
      country: payload.shippingAddress.country || "India",
    },
    createdAt: now,
    updatedAt: now,
    discountCode: payload.discountCode,
  };
}
