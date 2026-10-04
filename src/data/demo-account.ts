/**
 * Dearr V1 Demo Account Data
 *
 * Local demo data for the Customer Account screen (Task C-14).
 * Maps to future MySQL `profiles` table (docs/5.SCHEMA(1).md §2.1).
 *
 * This module provides a typed customer profile interface and a single
 * demo customer instance. Replace with real API calls when backend is ready.
 */

export interface DemoProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "customer";
  createdAt: string;
}

export interface DemoAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export const DEMO_CUSTOMER: DemoProfile = {
  id: "demo-customer-001",
  fullName: "Pavan Kumar",
  email: "pavan@dearr.in",
  phone: "+91 98765 43210",
  role: "customer",
  createdAt: "2025-06-15T10:30:00.000Z",
};

export const DEMO_ADDRESSES: DemoAddress[] = [
  {
    id: "addr-001",
    label: "Home",
    fullName: "Pavan Kumar",
    phone: "+91 98765 43210",
    addressLine1: "42, Creative Lane, Ameerpet",
    addressLine2: "Near Metro Station, Landmark Tower",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: "500038",
    country: "India",
    isDefault: true,
  },
  {
    id: "addr-002",
    label: "Office",
    fullName: "Pavan Kumar",
    phone: "+91 98765 43210",
    addressLine1: "5th Floor, Tech Hub, Madhapur",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: "500081",
    country: "India",
    isDefault: false,
  },
];
