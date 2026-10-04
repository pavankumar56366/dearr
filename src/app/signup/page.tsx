import type { Metadata } from "next";
import { SignupView } from "@/components/customer/auth/SignupView";

export const metadata: Metadata = {
  title: "Create Account — Dearr | 3D Printed Products",
  description: "Sign up for a Dearr account to order custom 3D prints, build your wishlist, and manage delivery addresses.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupPage() {
  return (
    <main className="w-full min-h-screen flex flex-col items-center justify-center bg-[#F4F1E8]">
      <SignupView />
    </main>
  );
}
