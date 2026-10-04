import type { Metadata } from "next";
import { ForgotPasswordView } from "@/components/customer/auth/ForgotPasswordView";

export const metadata: Metadata = {
  title: "Forgot Password — Dearr | 3D Printed Products",
  description: "Recover access to your Dearr account to manage custom 3D print orders and wishlists.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return (
    <main className="w-full min-h-screen flex flex-col items-center justify-center bg-[#F4F1E8]">
      <ForgotPasswordView />
    </main>
  );
}
