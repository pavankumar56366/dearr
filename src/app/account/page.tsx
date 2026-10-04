import type { Metadata } from "next";
import AccountPageClient from "./AccountPageClient";

export const metadata: Metadata = {
  title: "My Account — Dearr | 3D Printed Products",
  description: "Manage your Dearr account, view order history, and update your profile.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPage() {
  return <AccountPageClient />;
}
