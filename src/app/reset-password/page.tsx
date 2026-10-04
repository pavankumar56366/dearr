import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordView } from "@/components/customer/auth/ResetPasswordView";

export const metadata: Metadata = {
  title: "Reset Password — Dearr | 3D Printed Products",
  description: "Reset your Dearr account password.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return (
    <main className="w-full min-h-screen flex flex-col items-center justify-center bg-[#F4F1E8]">
      <Suspense
        fallback={
          <div className="min-h-[400px] flex items-center justify-center">
            <span className="text-xs font-semibold text-neutral-500">Loading Password Reset...</span>
          </div>
        }
      >
        <ResetPasswordView />
      </Suspense>
    </main>
  );
}
