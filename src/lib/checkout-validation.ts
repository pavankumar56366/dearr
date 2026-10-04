import { z } from "zod";

/**
 * deliveryAddressSchema — Validates delivery address matching docs/5.SCHEMA(1).md
 * addresses and orders tables (full_name, phone, address_line_1, address_line_2, city, state, postal_code, country).
 */
export const deliveryAddressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address for tracking & invoice updates"),
  addressLine1: z
    .string()
    .trim()
    .min(5, "Flat/House no., building, and street name required (min 5 characters)"),
  addressLine2: z
    .string()
    .trim()
    .optional(),
  city: z
    .string()
    .trim()
    .min(2, "City / Town is required"),
  state: z
    .string()
    .trim()
    .min(2, "State / Province is required"),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Please enter a valid 6-digit Indian PIN code (e.g. 560001)"),
  country: z
    .string()
    .default("India"),
});

export type DeliveryAddressFormValues = z.infer<typeof deliveryAddressSchema>;

export type DeliveryAddressErrors = Partial<Record<keyof DeliveryAddressFormValues, string>>;

/**
 * Validate delivery address fields safely with inline error extraction
 */
export function validateDeliveryAddress(data: unknown): {
  success: boolean;
  data?: DeliveryAddressFormValues;
  errors: DeliveryAddressErrors;
} {
  const result = deliveryAddressSchema.safeParse(data);
  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: {},
    };
  }

  const errors: DeliveryAddressErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof DeliveryAddressFormValues;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return {
    success: false,
    errors,
  };
}

/**
 * Sample verified delivery address for testing/demo convenience
 */
export const DEMO_DELIVERY_ADDRESS: DeliveryAddressFormValues = {
  fullName: "Henry Designer",
  phone: "9876543210",
  email: "henry@example.com",
  addressLine1: "Plot 42, 3D Innovation Park, 4th Cross",
  addressLine2: "Indiranagar Stage 2",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560038",
  country: "India",
};
