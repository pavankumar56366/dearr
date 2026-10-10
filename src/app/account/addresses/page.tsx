import type { Metadata } from "next";
import AddressesPageClient from "./AddressesPageClient";

export const metadata: Metadata = {
  title: "Delivery Addresses — Dearr | 3D Printed Products",
  description: "Manage your saved delivery addresses for fast and seamless Dearr checkout.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AddressesPage() {
  return <AddressesPageClient />;
}
