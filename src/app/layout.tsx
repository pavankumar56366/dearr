import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { StorefrontShell } from "@/components/customer";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Dearr — 3D Printed Products | Love Collects. We Deliver.",
  description: "Precision 3D printed products — spiritual idols, articulated toys, custom keychains, desk organizers, lithophane lamps and more. Delivered across India.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FFFDF8",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-canvas text-neutral-700 font-sans antialiased flex flex-col">
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <StorefrontShell>{children}</StorefrontShell>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
