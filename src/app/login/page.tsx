import type { Metadata } from "next";
import { LoginView } from "@/components/customer/auth/LoginView";

export const metadata: Metadata = {
  title: "Login — Dearr",
  description: "Sign in to your Dearr account to manage your gift orders, wishlist, and deliveries.",
};

export default function LoginPage() {
  return (
    <main className="w-full min-h-screen flex flex-col items-center justify-center bg-[#F4F1E8]">
      <LoginView />
    </main>
  );
}
