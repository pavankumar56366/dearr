/**
 * Dearr V1 Admin Settings & Store Configuration Domain Model & Session Storage
 *
 * Source of Truth for Dearr Founder/Admin Settings (Task A-17).
 * Centralizes configuration for store information, storefront controls,
 * checkout parameters, order fulfillment rules, customer account requirements,
 * notification preferences, and brand palette specifications.
 *
 * NOTE: In V1 prototype, these settings are configuration data persisted in
 * sessionStorage["dearr_admin_settings"]. Real email services, automatic payment
 * thresholds, and maintenance routing will be connected during backend implementation.
 */

export interface AdminSettings {
  // Store Information
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  businessAddress: string;
  city: string;
  state: string;
  postalCode: string;

  // Storefront Settings
  storefrontEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  showAnnouncementBar: boolean;
  announcementEnabled: boolean;
  announcementText: string;

  // Checkout Settings (INR)
  minimumOrderValue: number;
  freeShippingThreshold: number;
  defaultShippingFee: number;
  codEnabled: boolean;
  prepaidEnabled: boolean;

  // Order Settings
  autoConfirmOrders: boolean;
  allowOrderCancellation: boolean;
  cancellationWindowHours: number;
  notifyOnNewOrder: boolean;

  // Customer Settings
  allowCustomerSignup: boolean;
  allowGuestCheckout: boolean;
  requirePhone: boolean;
  requireAddress: boolean;

  // Notification Settings (Email toggles)
  emailOrderConfirmation: boolean;
  emailOrderShipped: boolean;
  emailOrderDelivered: boolean;
  emailOrderCancelled: boolean;
  emailNewCustomer: boolean;
  emailNewReview: boolean;

  // Store Appearance
  primaryColor: string;
  secondaryColor: string;
}

export const ADMIN_SETTINGS_STORAGE_KEY = "dearr_admin_settings";

/**
 * Approved Dearr Design Tokens
 */
export const APPROVED_DEARR_PALETTE = {
  primary: "#A2CB8B",
  secondary: "#FFCB56",
  canvas: "#F7F6F2",
  surface: "#FFFFFF",
  dark: "#1E1E1E",
} as const;

/**
 * Default Dearr Store Configuration
 */
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  // Store Information
  storeName: "Dearr",
  tagline: "3D Printed Collectibles & Custom Artifacts",
  supportEmail: "support@dearr.in",
  supportPhone: "+91 98201 54321",
  businessAddress: "Studio 104, Maker Hub, MIDC Industrial Area",
  city: "Mumbai",
  state: "Maharashtra",
  postalCode: "400093",

  // Storefront Settings
  storefrontEnabled: true,
  maintenanceMode: false,
  maintenanceMessage:
    "Dearr is currently undergoing scheduled print workshop maintenance. We'll be back shortly!",
  showAnnouncementBar: true,
  announcementEnabled: true,
  announcementText:
    "Free Express Shipping on all 3D printed orders above ₹999 across India!",

  // Checkout Settings
  minimumOrderValue: 199,
  freeShippingThreshold: 999,
  defaultShippingFee: 50,
  codEnabled: true,
  prepaidEnabled: true,

  // Order Settings
  autoConfirmOrders: false,
  allowOrderCancellation: true,
  cancellationWindowHours: 12,
  notifyOnNewOrder: true,

  // Customer Settings
  allowCustomerSignup: true,
  allowGuestCheckout: false,
  requirePhone: true,
  requireAddress: true,

  // Notification Settings
  emailOrderConfirmation: true,
  emailOrderShipped: true,
  emailOrderDelivered: true,
  emailOrderCancelled: true,
  emailNewCustomer: true,
  emailNewReview: true,

  // Store Appearance
  primaryColor: APPROVED_DEARR_PALETTE.primary,
  secondaryColor: APPROVED_DEARR_PALETTE.secondary,
};

/**
 * Retrieve current settings from sessionStorage or fallback to DEFAULT_ADMIN_SETTINGS.
 * SSR-safe and gracefully recovers from malformed data.
 */
export function getAdminSettings(): AdminSettings {
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          // Merge with defaults to ensure all required fields exist
          return {
            ...DEFAULT_ADMIN_SETTINGS,
            ...parsed,
            // Enforce approved primary and secondary brand colors
            primaryColor: APPROVED_DEARR_PALETTE.primary,
            secondaryColor: APPROVED_DEARR_PALETTE.secondary,
          };
        }
      } else {
        // Initialize sessionStorage with default settings
        sessionStorage.setItem(
          ADMIN_SETTINGS_STORAGE_KEY,
          JSON.stringify(DEFAULT_ADMIN_SETTINGS)
        );
      }
    } catch (e) {
      console.error(
        "Failed to read admin settings from sessionStorage; falling back to defaults:",
        e
      );
    }
  }

  return DEFAULT_ADMIN_SETTINGS;
}

/**
 * Persist complete settings object to sessionStorage.
 */
export function saveAdminSettings(settings: AdminSettings): AdminSettings {
  const merged: AdminSettings = {
    ...DEFAULT_ADMIN_SETTINGS,
    ...settings,
    primaryColor: APPROVED_DEARR_PALETTE.primary,
    secondaryColor: APPROVED_DEARR_PALETTE.secondary,
  };

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        ADMIN_SETTINGS_STORAGE_KEY,
        JSON.stringify(merged)
      );
    } catch (e) {
      console.error("Failed to save admin settings to sessionStorage:", e);
    }
  }

  return merged;
}

/**
 * Update settings partially.
 */
export function updateAdminSettings(
  updates: Partial<AdminSettings>
): AdminSettings {
  const current = getAdminSettings();
  const updated: AdminSettings = {
    ...current,
    ...updates,
    primaryColor: APPROVED_DEARR_PALETTE.primary,
    secondaryColor: APPROVED_DEARR_PALETTE.secondary,
  };

  return saveAdminSettings(updated);
}

/**
 * Reset settings to Dearr defaults in sessionStorage.
 */
export function resetAdminSettings(): AdminSettings {
  return saveAdminSettings(DEFAULT_ADMIN_SETTINGS);
}
