"use client";

import React from "react";
import { AuthShell } from "./AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export function ForgotPasswordView() {
  return (
    <AuthShell
      title="Forgot Password"
      subtitle="Enter your registered email address to receive password recovery instructions"
      topAction={{
        text: "Remember your login?",
        linkText: "Log In",
        href: "/login",
      }}
      heroBadge="Account Security • Quick Recovery"
      heroHeading={
        <>
          Restore Access. <br />
          <span className="text-secondary">Keep Creating.</span>
        </>
      }
      heroText="Never lose track of your custom 3D prints. Recover your account access safely with encrypted password reset verification."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
