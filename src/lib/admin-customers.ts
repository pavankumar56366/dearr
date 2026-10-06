/**
 * Dearr V1 Admin Customers Domain Model & Session Storage
 *
 * Source of Truth for Dearr Founder/Admin Customer Management (Task A-15).
 * Represents registered storefront customers, tracking contact information,
 * status lifecycle (active/inactive/blocked), order history, and spending metrics.
 */

import { getAllAdminOrders, AdminOrder } from "./admin-orders";

export type CustomerStatus = "active" | "inactive" | "blocked" | "suspended";

export interface CustomerAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  status: CustomerStatus;
  joinedAt: string; // ISO string
  lastOrderAt?: string; // ISO string
  orderCount: number;
  totalSpent: number;
  currency: "INR";
  defaultAddress?: CustomerAddress;
  notes?: string;
}

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  customersWithOrders: number;
  totalRevenue: number;
}

export const ADMIN_CUSTOMERS_STORAGE_KEY = "dearr_admin_customers";

/**
 * Realistic Base Demo Customers for Dearr 3D Printing Store
 */
export const BASE_CUSTOMERS: AdminCustomer[] = [
  {
    id: "cust_dearr_001",
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    phone: "+91 98201 54321",
    status: "active",
    joinedAt: "2026-08-15T10:00:00.000Z",
    lastOrderAt: "2026-09-24T11:20:00.000Z",
    orderCount: 1,
    totalSpent: 1248,
    currency: "INR",
    defaultAddress: {
      fullName: "Aarav Sharma",
      phone: "+91 98201 54321",
      addressLine1: "Flat 402, Green Meadows, Lokhandwala",
      addressLine2: "Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400053",
      country: "India",
    },
    notes: "Prefers eco-friendly packaging for 3D printed idols.",
  },
  {
    id: "cust_dearr_002",
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: "+91 99042 12345",
    status: "active",
    joinedAt: "2026-09-01T14:30:00.000Z",
    lastOrderAt: "2026-09-28T14:30:00.000Z",
    orderCount: 1,
    totalSpent: 764,
    currency: "INR",
    defaultAddress: {
      fullName: "Priya Patel",
      phone: "+91 99042 12345",
      addressLine1: "12, Shanti Niketan Society, Satellite",
      city: "Ahmedabad",
      state: "Gujarat",
      postalCode: "380015",
      country: "India",
    },
    notes: "Repeat customer interested in minimalist sculpture designs.",
  },
  {
    id: "cust_dearr_003",
    name: "Rohan Verma",
    email: "rohan.verma@example.com",
    phone: "+91 98110 98765",
    status: "active",
    joinedAt: "2026-09-10T11:20:00.000Z",
    lastOrderAt: "2026-09-27T08:45:00.000Z",
    orderCount: 1,
    totalSpent: 1499,
    currency: "INR",
    defaultAddress: {
      fullName: "Rohan Verma",
      phone: "+91 98110 98765",
      addressLine1: "B-204, Pinnacle Heights, Sector 62",
      city: "Noida",
      state: "Uttar Pradesh",
      postalCode: "201309",
      country: "India",
    },
    notes: "Collector of articulated dragons and silk filament items.",
  },
  {
    id: "cust_dearr_004",
    name: "Ananya Iyer",
    email: "ananya.iyer@example.com",
    phone: "+91 94440 33221",
    status: "active",
    joinedAt: "2026-09-12T09:15:00.000Z",
    lastOrderAt: "2026-09-29T19:10:00.000Z",
    orderCount: 1,
    totalSpent: 499,
    currency: "INR",
    defaultAddress: {
      fullName: "Ananya Iyer",
      phone: "+91 94440 33221",
      addressLine1: "No. 8, Karpagam Avenue, R.A. Puram",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600028",
      country: "India",
    },
  },
  {
    id: "cust_dearr_005",
    name: "Vikram Malhotra",
    email: "vikram.m@example.com",
    phone: "+91 98712 34567",
    status: "active",
    joinedAt: "2026-09-15T16:40:00.000Z",
    lastOrderAt: "2026-09-30T07:30:00.000Z",
    orderCount: 1,
    totalSpent: 899,
    currency: "INR",
    defaultAddress: {
      fullName: "Vikram Malhotra",
      phone: "+91 98712 34567",
      addressLine1: "House 14, Golf Links",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110003",
      country: "India",
    },
  },
  {
    id: "cust_dearr_006",
    name: "Sneha Reddy",
    email: "sneha.reddy@example.com",
    phone: "+91 98490 87654",
    status: "active",
    joinedAt: "2026-09-20T18:00:00.000Z",
    lastOrderAt: "2026-09-30T09:40:00.000Z",
    orderCount: 1,
    totalSpent: 999,
    currency: "INR",
    defaultAddress: {
      fullName: "Sneha Reddy",
      phone: "+91 98490 87654",
      addressLine1: "Villa 22, Whisper Valley, Jubilee Hills",
      city: "Hyderabad",
      state: "Telangana",
      postalCode: "500033",
      country: "India",
    },
  },
  {
    id: "cust_dearr_007",
    name: "Kavita Rao",
    email: "kavita.rao@example.com",
    phone: "+91 97411 22334",
    status: "active",
    joinedAt: "2026-08-25T12:00:00.000Z",
    lastOrderAt: "2026-09-18T16:20:00.000Z",
    orderCount: 1,
    totalSpent: 458,
    currency: "INR",
    defaultAddress: {
      fullName: "Kavita Rao",
      phone: "+91 97411 22334",
      addressLine1: "301, Brigade Orchards, Devanahalli",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "562110",
      country: "India",
    },
  },
  {
    id: "cust_dearr_008",
    name: "Arjun Nair",
    email: "arjun.nair@example.com",
    phone: "+91 98950 44556",
    status: "active",
    joinedAt: "2026-09-05T08:30:00.000Z",
    lastOrderAt: "2026-09-20T12:00:00.000Z",
    orderCount: 1,
    totalSpent: 399,
    currency: "INR",
    defaultAddress: {
      fullName: "Arjun Nair",
      phone: "+91 98950 44556",
      addressLine1: "Panampilly Nagar, 5th Cross Road",
      city: "Kochi",
      state: "Kerala",
      postalCode: "682036",
      country: "India",
    },
    notes: "Requested order cancellation prior to print dispatch; refunded promptly.",
  },
  {
    id: "cust_dearr_009",
    name: "Meera Joshi",
    email: "meera.joshi@example.com",
    phone: "+91 98220 77889",
    status: "active",
    joinedAt: "2026-09-22T15:00:00.000Z",
    lastOrderAt: "2026-09-30T15:10:00.000Z",
    orderCount: 1,
    totalSpent: 1199,
    currency: "INR",
    defaultAddress: {
      fullName: "Meera Joshi",
      phone: "+91 98220 77889",
      addressLine1: "74, Prabhat Road, Lane 10",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411004",
      country: "India",
    },
  },
  {
    id: "cust_dearr_010",
    name: "Aditya Sen",
    email: "aditya.sen@example.com",
    phone: "+91 98300 11223",
    status: "active",
    joinedAt: "2026-09-28T10:10:00.000Z",
    orderCount: 1,
    totalSpent: 1299,
    currency: "INR",
    defaultAddress: {
      fullName: "Aditya Sen",
      phone: "+91 98300 11223",
      addressLine1: "48A, Southern Avenue",
      city: "Kolkata",
      state: "West Bengal",
      postalCode: "700029",
      country: "India",
    },
  },
  {
    id: "cust_dearr_011",
    name: "Rahul Kumar",
    email: "rahul.k@example.com",
    phone: "+91 98765 43210",
    status: "active",
    joinedAt: "2026-07-14T11:00:00.000Z",
    lastOrderAt: "2026-09-30T10:00:00.000Z",
    orderCount: 3,
    totalSpent: 5490,
    currency: "INR",
    defaultAddress: {
      fullName: "Rahul Kumar",
      phone: "+91 98765 43210",
      addressLine1: "Tower 4, Flat 12B, DLF Phase 5",
      city: "Gurgaon",
      state: "Haryana",
      postalCode: "122009",
      country: "India",
    },
    notes: "VIP customer. Frequently orders multi-part articulated toys & figurines.",
  },
  {
    id: "cust_dearr_012",
    name: "Divya Choudhury",
    email: "divya.c@example.com",
    phone: "+91 99123 77441",
    status: "active",
    joinedAt: "2026-09-29T18:30:00.000Z",
    orderCount: 0,
    totalSpent: 0,
    currency: "INR",
    defaultAddress: {
      fullName: "Divya Choudhury",
      phone: "+91 99123 77441",
      addressLine1: "Plot 104, Saheed Nagar",
      city: "Bhubaneswar",
      state: "Odisha",
      postalCode: "751007",
      country: "India",
    },
    notes: "Signed up via referral link; exploring spiritual figurine collections.",
  },
  {
    id: "cust_dearr_013",
    name: "Karan Singhania",
    email: "karan.singhania@example.com",
    phone: "+91 98200 99887",
    status: "inactive",
    joinedAt: "2026-03-12T09:00:00.000Z",
    orderCount: 0,
    totalSpent: 0,
    currency: "INR",
    defaultAddress: {
      fullName: "Karan Singhania",
      phone: "+91 98200 99887",
      addressLine1: "C-18, Malviya Nagar",
      city: "Jaipur",
      state: "Rajasthan",
      postalCode: "302017",
      country: "India",
    },
    notes: "Account inactive for >180 days; no recent logins or purchases.",
  },
  {
    id: "cust_dearr_014",
    name: "Suresh Pillai",
    email: "suresh.pillai@example.com",
    phone: "+91 98450 33112",
    status: "blocked",
    joinedAt: "2026-05-18T14:20:00.000Z",
    lastOrderAt: "2026-06-02T16:00:00.000Z",
    orderCount: 1,
    totalSpent: 1899,
    currency: "INR",
    defaultAddress: {
      fullName: "Suresh Pillai",
      phone: "+91 98450 33112",
      addressLine1: "TC 24/1105, Kowdiar",
      city: "Thiruvananthapuram",
      state: "Kerala",
      postalCode: "695003",
      country: "India",
    },
    notes: "ACCOUNT BLOCKED: Flagged for repeated payment gateway chargeback fraud and abusive support inquiries.",
  },
  {
    id: "cust_dearr_015",
    name: "Pooja Deshmukh",
    email: "pooja.deshmukh@example.com",
    phone: "+91 97654 11223",
    status: "active",
    joinedAt: "2026-08-01T12:00:00.000Z",
    lastOrderAt: "2026-09-29T12:00:00.000Z",
    orderCount: 4,
    totalSpent: 8450,
    currency: "INR",
    defaultAddress: {
      fullName: "Pooja Deshmukh",
      phone: "+91 97654 11223",
      addressLine1: "Flat 503, Silver Oak Apartments, Dharampeth",
      city: "Nagpur",
      state: "Maharashtra",
      postalCode: "440010",
      country: "India",
    },
    notes: "High-value loyal collector of 3D printed custom sculptures & home accents.",
  },
  {
    id: "cust_dearr_016",
    name: "Tenzin Norbu",
    email: "tenzin.norbu@example.com",
    phone: "+91 98050 66778",
    status: "inactive",
    joinedAt: "2026-06-10T10:00:00.000Z",
    lastOrderAt: "2026-06-15T11:00:00.000Z",
    orderCount: 1,
    totalSpent: 750,
    currency: "INR",
    defaultAddress: {
      fullName: "Tenzin Norbu",
      phone: "+91 98050 66778",
      addressLine1: "Temple Road, McLeod Ganj",
      city: "Dharamshala",
      state: "Himachal Pradesh",
      postalCode: "176219",
      country: "India",
    },
    notes: "Customer requested account dormancy.",
  },
];

/**
 * Synchronize a customer with existing orders in the system.
 * Derives dynamic order count, total spend, and latest order timestamp.
 */
function enrichCustomerWithOrders(
  customer: AdminCustomer,
  allOrders: AdminOrder[]
): AdminCustomer {
  const customerEmail = customer.email.trim().toLowerCase();
  const customerPhone = customer.phone.replace(/\D/g, "");

  const matchingOrders = allOrders.filter((order) => {
    const orderEmail = order.customer.email.trim().toLowerCase();
    const orderPhone = order.customer.phone.replace(/\D/g, "");
    return (
      (orderEmail && orderEmail === customerEmail) ||
      (customerPhone && orderPhone && orderPhone === customerPhone)
    );
  });

  if (matchingOrders.length === 0) {
    return customer;
  }

  // Calculate live order count and total spend
  const liveOrderCount = matchingOrders.length;
  const liveTotalSpent = matchingOrders.reduce((acc, order) => {
    // If order was refunded, we do not count it towards net customer revenue
    if (order.paymentStatus === "refunded") return acc;
    return acc + order.totalAmount;
  }, 0);

  // Determine latest order date
  const sortedOrders = [...matchingOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const liveLastOrderAt = sortedOrders[0]?.createdAt || customer.lastOrderAt;

  return {
    ...customer,
    orderCount: Math.max(customer.orderCount, liveOrderCount),
    totalSpent: Math.max(customer.totalSpent, liveTotalSpent),
    lastOrderAt: liveLastOrderAt,
  };
}

/**
 * Retrieve all Admin Customers from sessionStorage or fallback to BASE_CUSTOMERS.
 * Automatically enriches records with live order data from getAllAdminOrders().
 */
export function getAllAdminCustomers(): AdminCustomer[] {
  let customers: AdminCustomer[] = BASE_CUSTOMERS;

  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(ADMIN_CUSTOMERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customers = parsed;
        }
      } else {
        // Initialize sessionStorage with base customers
        sessionStorage.setItem(
          ADMIN_CUSTOMERS_STORAGE_KEY,
          JSON.stringify(BASE_CUSTOMERS)
        );
      }
    } catch (e) {
      console.error("Failed to read admin customers from sessionStorage:", e);
    }
  }

  // Dynamically enrich customer order metrics using live order state
  const liveOrders = getAllAdminOrders();
  return customers.map((c) => enrichCustomerWithOrders(c, liveOrders));
}

/**
 * Retrieve a single Admin Customer by ID.
 */
export function getAdminCustomerById(id: string): AdminCustomer | null {
  const all = getAllAdminCustomers();
  return all.find((c) => c.id === id) || null;
}

/**
 * Save / Insert a new customer into sessionStorage.
 */
export function saveAdminCustomer(customer: AdminCustomer): AdminCustomer {
  const all = getAllAdminCustomers();
  const existingIndex = all.findIndex((c) => c.id === customer.id);
  let updatedList: AdminCustomer[];

  if (existingIndex >= 0) {
    updatedList = [...all];
    updatedList[existingIndex] = customer;
  } else {
    updatedList = [customer, ...all];
  }

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        ADMIN_CUSTOMERS_STORAGE_KEY,
        JSON.stringify(updatedList)
      );
    } catch (e) {
      console.error("Failed to save admin customer to sessionStorage:", e);
    }
  }

  return customer;
}

/**
 * Update an existing customer partially.
 */
export function updateAdminCustomer(
  id: string,
  updates: Partial<AdminCustomer>
): AdminCustomer | null {
  const all = getAllAdminCustomers();
  const index = all.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const current = all[index];
  const updated: AdminCustomer = {
    ...current,
    ...updates,
    id: current.id, // Immutable ID
  };

  all[index] = updated;

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        ADMIN_CUSTOMERS_STORAGE_KEY,
        JSON.stringify(all)
      );
    } catch (e) {
      console.error("Failed to update admin customer in sessionStorage:", e);
    }
  }

  return updated;
}

/**
 * Change customer lifecycle status (active | inactive | blocked).
 * If a reason/note is provided, appends to internal notes.
 */
export function toggleAdminCustomerStatus(
  id: string,
  newStatus: CustomerStatus,
  reason?: string
): AdminCustomer | null {
  const customer = getAdminCustomerById(id);
  if (!customer) return null;

  let updatedNotes = customer.notes || "";
  if (reason) {
    const timestamp = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const logEntry = `[${timestamp} Status Change -> ${newStatus.toUpperCase()}]: ${reason}`;
    updatedNotes = updatedNotes ? `${updatedNotes}\n${logEntry}` : logEntry;
  }

  return updateAdminCustomer(id, {
    status: newStatus,
    notes: updatedNotes,
  });
}

/**
 * Compute aggregate metrics dynamically from customer list.
 */
export function getCustomerMetrics(
  customersList?: AdminCustomer[]
): CustomerMetrics {
  const customers = customersList || getAllAdminCustomers();

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === "active").length;

  // New customers defined as joined in the last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const newCustomers = customers.filter((c) => {
    const joined = new Date(c.joinedAt);
    return !isNaN(joined.getTime()) && joined >= thirtyDaysAgo;
  }).length;

  const customersWithOrders = customers.filter((c) => c.orderCount > 0).length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

  return {
    totalCustomers,
    activeCustomers,
    newCustomers,
    customersWithOrders,
    totalRevenue,
  };
}
