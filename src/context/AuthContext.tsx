"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export interface CustomerUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: "customer" | "admin";
  createdAt: string | Date;
}

interface AuthContextType {
  user: CustomerUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; user?: CustomerUser }>;
  signup: (formData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<{ ok: boolean; error?: string; user?: CustomerUser }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider manages customer authentication state across the Dearr storefront.
 *
 * Security Guarantee:
 * - NEVER stores authentication tokens or secrets in localStorage or sessionStorage.
 * - Relies entirely on the secure httpOnly "dearr_session" cookie managed by the server.
 * - Hydrates session state through GET /api/auth/me on mount.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok && data.ok && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string; user?: CustomerUser }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.user) {
        setUser(data.user);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.error || "Invalid email or password" };
    } catch {
      return {
        ok: false,
        error: "Unable to connect to the server. Please try again.",
      };
    }
  };

  const signup = async (formData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<{ ok: boolean; error?: string; user?: CustomerUser }> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.user) {
        setUser(data.user);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.error || "Registration failed" };
    } catch {
      return {
        ok: false,
        error: "Unable to connect to the server. Please try again.",
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Ignore network error during logout
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("dearr_customer_user");
          sessionStorage.removeItem("dearr_auth_session");
          localStorage.removeItem("dearr_customer_user");
          localStorage.removeItem("dearr_auth_session");
        } catch {
          // Ignore storage restrictions
        }
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        signup,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
