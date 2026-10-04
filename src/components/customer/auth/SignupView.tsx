"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "./AuthShell";
import { SignupForm } from "./SignupForm";

export function SignupView() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace("/account");
    }
  }, [isLoading, isLoggedIn, router]);

  return (
    <AuthShell
      title="Create Account"
      subtitle="Join Dearr to order custom 3D prints, build your wishlist, and track orders"
      topAction={{
        text: "Already a member?",
        linkText: "Log In",
        href: "/login",
      }}
      heroBadge="Custom 3D Fabrication • Fast Delivery"
      heroHeading={
        <>
          Print Your Vision. <br />
          <span className="text-secondary">We Deliver.</span>
        </>
      }
      heroText="Create an account to save custom filaments, track precision print queues in real-time, and store domestic delivery addresses."
    >
      <SignupForm />
    </AuthShell>
  );
}
