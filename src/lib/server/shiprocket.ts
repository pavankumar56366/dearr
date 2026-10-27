import "server-only";
import crypto from "crypto";

/**
 * =============================================================================
 * Shiprocket Shipping & Logistics Service Library
 * =============================================================================
 * Authoritative server-side integration for Shiprocket APIs (v2 console).
 * Provides authentication, token caching, courier serviceability checks,
 * ad-hoc order creation, AWB generation, pickup scheduling, label/manifest
 * generation, shipment tracking, and status mapping to Dearr's 4-stage tracking.
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------

export const DEFAULT_SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";
export const DEFAULT_PICKUP_LOCATION = "Primary";
export const TOKEN_REFRESH_SAFETY_MARGIN_MS = 12 * 60 * 60 * 1000; // 12 hours before 10-day expiry

export class ShiprocketError extends Error {
  statusCode: number;
  data?: unknown;

  constructor(message: string, statusCode = 500, data?: unknown) {
    super(message);
    this.name = "ShiprocketError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

export class ShiprocketConfigError extends ShiprocketError {
  constructor(message: string) {
    super(message, 503);
    this.name = "ShiprocketConfigError";
  }
}

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface ShiprocketSafeConfig {
  email: string;
  isConfigured: boolean;
  isEnabled: boolean;
  apiBaseUrl: string;
  pickupLocation: string;
  hasWebhookToken: boolean;
}

export interface ShiprocketTokenCache {
  token: string;
  expiresAt: number;
}

export interface CheckServiceabilityParams {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number;
  cod?: boolean;
  declaredValue?: number;
}

export interface ShiprocketCourierCompany {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  etd: string;
  estimated_delivery_days: string | number;
  cod: number;
  rating?: number;
  call_before_delivery?: string;
  blocked?: number;
}

export interface ShiprocketServiceabilityResult {
  isServiceable: boolean;
  recommendedCourierId?: number;
  recommendedCourierName?: string;
  availableCouriers: ShiprocketCourierCompany[];
  rawResponse?: unknown;
}

export interface ShiprocketOrderItemPayload {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  tax?: number;
  hsn?: number | string;
}

export interface ShiprocketCreateOrderPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  channel_id?: string;
  comment?: string;
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email?: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  shipping_customer_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_pincode?: string;
  shipping_country?: string;
  shipping_state?: string;
  shipping_email?: string;
  shipping_phone?: string;
  order_items: ShiprocketOrderItemPayload[];
  payment_method: "Prepaid" | "COD";
  shipping_charges?: number;
  giftwrap_charges?: number;
  transaction_charges?: number;
  total_discount?: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface ShiprocketCreateOrderResponse {
  order_id: number;
  shipment_id: number;
  status: string;
  status_code: number;
  onboarding_completed_now?: number;
  awb_code?: string;
  courier_company_id?: string | number;
  courier_name?: string;
}

export interface ShiprocketAWBResponse {
  awbAssignStatus: number;
  shipmentId: number;
  awbCode: string;
  courierCompanyId: number;
  courierName: string;
  assignedDateTime?: string;
  raw?: unknown;
}

export interface ShiprocketPickupResponse {
  pickupStatus: number;
  pickupScheduledDate?: string;
  pickupTokenNumber?: string;
  statusMessage?: string;
  raw?: unknown;
}

export interface ShiprocketLabelResponse {
  labelCreated: number;
  labelUrl: string;
  response?: unknown;
}

export interface ShiprocketManifestResponse {
  manifestUrl: string;
  response?: unknown;
}

export interface ShiprocketTrackingScan {
  date: string;
  status: string;
  activity: string;
  location: string;
  "sr-status"?: string;
}

export interface ShiprocketTrackingActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
}

export interface ShiprocketShipmentTrack {
  id: number;
  awb_code: string;
  courier_name: string;
  current_status: string;
  status: string;
  origin?: string;
  destination?: string;
  edd?: string;
  delivered_date?: string;
  scans?: ShiprocketTrackingScan[];
}

export interface ShiprocketTrackingResponse {
  trackStatus: number;
  shipmentStatus?: number | string;
  currentStatus: string;
  courierName?: string;
  awbCode?: string;
  edd?: string;
  deliveredDate?: string;
  scans: ShiprocketTrackingScan[];
  raw?: unknown;
}

export interface ShiprocketCancelResponse {
  success: boolean;
  message?: string;
  raw?: unknown;
}

export interface ShiprocketWebhookPayload {
  awb?: string;
  order_id?: string;
  shipment_id?: string | number;
  current_status?: string;
  current_status_id?: number;
  shipment_status?: string;
  shipment_status_id?: number;
  courier_name?: string;
  scans?: Array<{
    date?: string;
    activity?: string;
    location?: string;
    status?: string;
  }>;
  etd?: string;
  delivered_date?: string;
  pickup_date?: string;
  [key: string]: unknown;
}

// -----------------------------------------------------------------------------
// State & Token Management
// -----------------------------------------------------------------------------

let cachedTokenState: ShiprocketTokenCache | null = null;
let activeAuthPromise: Promise<string> | null = null;

/**
 * Resets cached authentication state (useful in automated tests or re-auth scenarios).
 */
export function resetShiprocketAuthCacheForTesting(): void {
  cachedTokenState = null;
  activeAuthPromise = null;
}

/**
 * Injects a mock token for unit testing without performing external HTTP network calls.
 */
export function setShiprocketMockTokenForTesting(token: string, expiresInHours = 24): void {
  cachedTokenState = {
    token,
    expiresAt: Date.now() + expiresInHours * 60 * 60 * 1000,
  };
}

// -----------------------------------------------------------------------------
// Environment Configuration Helpers
// -----------------------------------------------------------------------------

function getRawEmail(): string {
  return (process.env.SHIPROCKET_EMAIL || "").trim();
}

function getRawPassword(): string {
  return (process.env.SHIPROCKET_PASSWORD || "").trim();
}

export function getShiprocketBaseUrl(): string {
  return (process.env.SHIPROCKET_API_BASE_URL || DEFAULT_SHIPROCKET_BASE_URL).trim().replace(/\/+$/, "");
}

export function getShiprocketPickupLocation(): string {
  return (process.env.SHIPROCKET_PICKUP_LOCATION || DEFAULT_PICKUP_LOCATION).trim();
}

export function isShiprocketEnabled(): boolean {
  return process.env.SHIPROCKET_ENABLED === "true";
}

export function isShiprocketConfigured(): boolean {
  const email = getRawEmail();
  const password = getRawPassword();
  return email.length > 0 && password.length > 0;
}

export function getShiprocketConfig(): ShiprocketSafeConfig {
  const email = getRawEmail();
  const webhookToken = (process.env.SHIPROCKET_WEBHOOK_TOKEN || "").trim();

  return {
    email: email.length > 0 ? email : "",
    isConfigured: isShiprocketConfigured(),
    isEnabled: isShiprocketEnabled(),
    apiBaseUrl: getShiprocketBaseUrl(),
    pickupLocation: getShiprocketPickupLocation(),
    hasWebhookToken: webhookToken.length > 0,
  };
}

// -----------------------------------------------------------------------------
// Authentication & Token Fetching
// -----------------------------------------------------------------------------

/**
 * Acquires a valid Shiprocket JWT token. Caches the token for up to 10 days
 * with safety buffer, deduplicating concurrent authentication requests.
 */
export async function getShiprocketAuthToken(): Promise<string> {
  const now = Date.now();

  if (cachedTokenState && cachedTokenState.expiresAt - now > TOKEN_REFRESH_SAFETY_MARGIN_MS) {
    return cachedTokenState.token;
  }

  if (activeAuthPromise) {
    return activeAuthPromise;
  }

  activeAuthPromise = (async () => {
    try {
      const email = getRawEmail();
      const password = getRawPassword();

      if (!email || !password) {
        throw new ShiprocketConfigError(
          "Shiprocket credentials missing. Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in environment variables."
        );
      }

      const baseUrl = getShiprocketBaseUrl();
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let errMessage = `Shiprocket authentication failed with HTTP status ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody?.message) errMessage += `: ${errBody.message}`;
        } catch {
          // ignore parsing error
        }
        throw new ShiprocketError(errMessage, response.status);
      }

      const data = await response.json();
      const token = data?.token;

      if (!token || typeof token !== "string") {
        throw new ShiprocketError("Shiprocket auth response missing bearer token", 502, data);
      }

      // Shiprocket tokens are valid for 10 days (240 hours).
      // We set expiration to 9.5 days to be safe.
      const validityMs = 9.5 * 24 * 60 * 60 * 1000;
      cachedTokenState = {
        token,
        expiresAt: now + validityMs,
      };

      return token;
    } finally {
      activeAuthPromise = null;
    }
  })();

  return activeAuthPromise;
}

// -----------------------------------------------------------------------------
// Core HTTP Fetch Wrapper
// -----------------------------------------------------------------------------

interface ShiprocketFetchOptions extends RequestInit {
  retryOnUnauthorized?: boolean;
}

/**
 * Core authenticated fetch client for Shiprocket API.
 * Automatically injects the bearer token and refreshes once if a 401 is encountered.
 */
export async function shiprocketFetch<T>(
  endpoint: string,
  options: ShiprocketFetchOptions = {}
): Promise<T> {
  const { retryOnUnauthorized = true, ...fetchOptions } = options;
  const baseUrl = getShiprocketBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const token = await getShiprocketAuthToken();

  const headers = new Headers(fetchOptions.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (fetchOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Handle token expiration/revocation gracefully with a 1-time re-auth retry
  if (response.status === 401 && retryOnUnauthorized) {
    cachedTokenState = null;
    return shiprocketFetch<T>(endpoint, {
      ...options,
      retryOnUnauthorized: false,
    });
  }

  if (!response.ok) {
    let errorDetail = `Shiprocket API error: ${response.status} ${response.statusText}`;
    let bodyData: unknown = null;
    try {
      bodyData = await response.json();
      if (bodyData && typeof bodyData === "object") {
        const errorMsg =
          (bodyData as any).message ||
          (bodyData as any).error ||
          JSON.stringify((bodyData as any).errors || bodyData);
        errorDetail = `Shiprocket API error (${response.status}): ${errorMsg}`;
      }
    } catch {
      // Body not JSON
    }
    throw new ShiprocketError(errorDetail, response.status, bodyData);
  }

  return (await response.json()) as T;
}

// -----------------------------------------------------------------------------
// Service Methods
// -----------------------------------------------------------------------------

/**
 * Checks courier serviceability and rates for a given route and parcel weight.
 */
export async function checkCourierServiceability(
  params: CheckServiceabilityParams
): Promise<ShiprocketServiceabilityResult> {
  const query = new URLSearchParams({
    pickup_postcode: params.pickupPincode.trim(),
    delivery_postcode: params.deliveryPincode.trim(),
    weight: String(params.weightKg || 0.5),
    cod: params.cod ? "1" : "0",
  });

  if (params.declaredValue) {
    query.set("declared_value", String(params.declaredValue));
  }

  const response = await shiprocketFetch<any>(`/courier/serviceability/?${query.toString()}`, {
    method: "GET",
  });

  const availableCouriers: ShiprocketCourierCompany[] =
    response?.data?.available_courier_companies || [];

  const isServiceable = availableCouriers.length > 0;
  let recommendedCourierId: number | undefined;
  let recommendedCourierName: string | undefined;

  if (isServiceable) {
    const recommended = availableCouriers[0];
    recommendedCourierId = recommended.courier_company_id;
    recommendedCourierName = recommended.courier_name;
  }

  return {
    isServiceable,
    recommendedCourierId,
    recommendedCourierName,
    availableCouriers,
    rawResponse: response,
  };
}

/**
 * Creates an ad-hoc custom order in Shiprocket.
 */
export async function createShiprocketOrder(
  payload: ShiprocketCreateOrderPayload
): Promise<ShiprocketCreateOrderResponse> {
  const response = await shiprocketFetch<any>("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    order_id: response.order_id,
    shipment_id: response.shipment_id,
    status: response.status || "NEW",
    status_code: response.status_code || 1,
    onboarding_completed_now: response.onboarding_completed_now,
    awb_code: response.awb_code || "",
    courier_company_id: response.courier_company_id,
    courier_name: response.courier_name,
  };
}

/**
 * Assigns an AWB code and courier to a generated shipment.
 */
export async function generateShiprocketAWB(params: {
  shipmentId: number;
  courierId?: number;
}): Promise<ShiprocketAWBResponse> {
  const body: Record<string, unknown> = {
    shipment_id: params.shipmentId,
  };
  if (params.courierId) {
    body.courier_id = params.courierId;
  }

  const response = await shiprocketFetch<any>("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = response?.response?.data || response?.data || {};

  return {
    awbAssignStatus: response?.awb_assign_status ?? 1,
    shipmentId: Number(data.shipment_id || params.shipmentId),
    awbCode: String(data.awb_code || ""),
    courierCompanyId: Number(data.courier_company_id || 0),
    courierName: String(data.courier_name || ""),
    assignedDateTime: data.assigned_date_time,
    raw: response,
  };
}

/**
 * Requests courier pickup for one or more shipment IDs.
 */
export async function requestShiprocketPickup(
  shipmentIds: number[]
): Promise<ShiprocketPickupResponse> {
  const response = await shiprocketFetch<any>("/courier/generate/pickup", {
    method: "POST",
    body: JSON.stringify({
      shipment_id: shipmentIds,
    }),
  });

  const respData = response?.response || {};

  return {
    pickupStatus: response?.pickup_status ?? 1,
    pickupScheduledDate: respData.pickup_scheduled_date,
    pickupTokenNumber: respData.pickup_token_number,
    statusMessage: respData.status || response?.message,
    raw: response,
  };
}

/**
 * Generates shipping label PDF URL for specified shipment IDs.
 */
export async function generateShiprocketLabel(
  shipmentIds: number[]
): Promise<ShiprocketLabelResponse> {
  const response = await shiprocketFetch<any>("/courier/generate/label", {
    method: "POST",
    body: JSON.stringify({
      shipment_id: shipmentIds,
    }),
  });

  return {
    labelCreated: response?.label_created ?? 0,
    labelUrl: response?.label_url || "",
    response,
  };
}

/**
 * Generates shipment manifest document for specified shipment IDs.
 */
export async function generateShiprocketManifest(
  shipmentIds: number[]
): Promise<ShiprocketManifestResponse> {
  const response = await shiprocketFetch<any>("/manifests/generate", {
    method: "POST",
    body: JSON.stringify({
      shipment_id: shipmentIds,
    }),
  });

  return {
    manifestUrl: response?.manifest_url || "",
    response,
  };
}

/**
 * Fetches real-time shipment tracking details by AWB code.
 */
export async function trackShiprocketByAWB(
  awbCode: string
): Promise<ShiprocketTrackingResponse> {
  const response = await shiprocketFetch<any>(`/courier/track/awb/${encodeURIComponent(awbCode.trim())}`, {
    method: "GET",
  });

  const trackingData = response?.tracking_data || {};
  const tracks: ShiprocketShipmentTrack[] = trackingData.shipment_track || [];
  const primaryTrack = tracks[0] || ({} as Partial<ShiprocketShipmentTrack>);

  const scans: ShiprocketTrackingScan[] =
    primaryTrack.scans || trackingData.shipment_track_activities || [];

  return {
    trackStatus: trackingData.track_status ?? 0,
    shipmentStatus: trackingData.shipment_status,
    currentStatus: primaryTrack.current_status || primaryTrack.status || "UNKNOWN",
    courierName: primaryTrack.courier_name,
    awbCode: primaryTrack.awb_code || awbCode,
    edd: primaryTrack.edd,
    deliveredDate: primaryTrack.delivered_date,
    scans,
    raw: response,
  };
}

/**
 * Fetches real-time shipment tracking details by Order ID.
 */
export async function trackShiprocketByOrderId(
  orderId: string | number
): Promise<ShiprocketTrackingResponse> {
  const response = await shiprocketFetch<any>(`/courier/track/order/${encodeURIComponent(String(orderId).trim())}`, {
    method: "GET",
  });

  const trackingData = response?.tracking_data || {};
  const tracks: ShiprocketShipmentTrack[] = trackingData.shipment_track || [];
  const primaryTrack = tracks[0] || ({} as Partial<ShiprocketShipmentTrack>);
  const scans: ShiprocketTrackingScan[] =
    primaryTrack.scans || trackingData.shipment_track_activities || [];

  return {
    trackStatus: trackingData.track_status ?? 0,
    shipmentStatus: trackingData.shipment_status,
    currentStatus: primaryTrack.current_status || primaryTrack.status || "UNKNOWN",
    courierName: primaryTrack.courier_name,
    awbCode: primaryTrack.awb_code,
    edd: primaryTrack.edd,
    deliveredDate: primaryTrack.delivered_date,
    scans,
    raw: response,
  };
}

/**
 * Cancels shipments in Shiprocket by order IDs.
 */
export async function cancelShiprocketOrders(
  orderIds: (string | number)[]
): Promise<ShiprocketCancelResponse> {
  const response = await shiprocketFetch<any>("/orders/cancel", {
    method: "POST",
    body: JSON.stringify({
      ids: orderIds,
    }),
  });

  return {
    success: response?.status_code === 200 || response?.status === "SUCCESS",
    message: response?.message,
    raw: response,
  };
}

/**
 * Verifies webhook authorization against configured SHIPROCKET_WEBHOOK_TOKEN
 * using constant-time comparison to protect against timing attacks.
 */
export function verifyShiprocketWebhook(headerToken?: string | null): boolean {
  const expectedToken = (process.env.SHIPROCKET_WEBHOOK_TOKEN || "").trim();
  if (!expectedToken) {
    // Fail-closed for security if no webhook token is configured
    return false;
  }
  if (!headerToken) return false;

  const providedBuffer = Buffer.from(headerToken.trim());
  const expectedBuffer = Buffer.from(expectedToken);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}


// -----------------------------------------------------------------------------
// Mapping Helpers (Dearr <-> Shiprocket)
// -----------------------------------------------------------------------------

export interface OrderMappingInput {
  orderNumber: string;
  createdAt: Date | string;
  totalAmount: number;
  subtotal: number;
  discountAmount?: number;
  shippingAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingPostalCode: string;
  shippingState: string;
  shippingCountry?: string;
  customerEmail?: string;
  items: Array<{
    productName: string;
    variantName?: string | null;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
  }>;
}

/**
 * Converts a Dearr order record into a compliant Shiprocket adhoc order creation payload.
 */
export function mapDearrOrderToShiprocketPayload(
  order: OrderMappingInput,
  options: {
    pickupLocation?: string;
    weightKg?: number;
    dimensions?: { length: number; breadth: number; height: number };
  } = {}
): ShiprocketCreateOrderPayload {
  const nameParts = (order.shippingFullName || "Customer").trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Date formatted as YYYY-MM-DD HH:mm
  const dateObj = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  const dateFormatted = !isNaN(dateObj.getTime())
    ? dateObj.toISOString().slice(0, 16).replace("T", " ")
    : new Date().toISOString().slice(0, 16).replace("T", " ");

  const isCod = /cod|cash\s*on\s*delivery/i.test(order.paymentMethod || "");

  const orderItems: ShiprocketOrderItemPayload[] = order.items.map((item, idx) => ({
    name: (item.productName || "Product").slice(0, 240),
    sku: item.sku || `SKU-${idx + 1}`,
    units: Math.max(1, item.quantity),
    selling_price: Number(item.unitPrice),
    discount: Number(item.discountAmount || 0),
  }));

  return {
    order_id: order.orderNumber,
    order_date: dateFormatted,
    pickup_location: options.pickupLocation || getShiprocketPickupLocation(),
    comment: `Dearr Web Order ${order.orderNumber}`,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: order.shippingAddressLine1,
    billing_address_2: order.shippingAddressLine2 || "",
    billing_city: order.shippingCity,
    billing_pincode: order.shippingPostalCode,
    billing_state: order.shippingState,
    billing_country: order.shippingCountry || "India",
    billing_email: order.customerEmail || "orders@dearr.in",
    billing_phone: order.shippingPhone.replace(/[^\d+]/g, "").slice(-10),
    shipping_is_billing: true,
    shipping_customer_name: firstName,
    shipping_last_name: lastName,
    shipping_address: order.shippingAddressLine1,
    shipping_address_2: order.shippingAddressLine2 || "",
    shipping_city: order.shippingCity,
    shipping_pincode: order.shippingPostalCode,
    shipping_country: order.shippingCountry || "India",
    shipping_state: order.shippingState,
    shipping_email: order.customerEmail || "orders@dearr.in",
    shipping_phone: order.shippingPhone.replace(/[^\d+]/g, "").slice(-10),
    order_items: orderItems,
    payment_method: isCod ? "COD" : "Prepaid",
    shipping_charges: Number(order.shippingAmount || 0),
    total_discount: Number(order.discountAmount || 0),
    sub_total: Number(order.subtotal),
    length: options.dimensions?.length || 10,
    breadth: options.dimensions?.breadth || 10,
    height: options.dimensions?.height || 10,
    weight: Math.max(0.1, options.weightKg || 0.5),
  };
}

/**
 * Maps courier tracking activity & Shiprocket status text into Dearr's canonical
 * 4-stage tracking flow:
 * Stage 1: Order Received
 * Stage 2: Payment
 * Stage 3: Packed & Dispatched
 * Stage 4: Delivered
 */
export function mapShiprocketStatusToTracking(statusText?: string): {
  stageId: "received" | "payment" | "packed_dispatched" | "delivered";
  badge: string;
  isDispatched: boolean;
  isDelivered: boolean;
  isCancelled: boolean;
} {
  const norm = (statusText || "").trim().toUpperCase();

  if (/CANCEL|REJECT|RETURNED_TO_ORIGIN|RTO/.test(norm)) {
    return {
      stageId: "packed_dispatched",
      badge: "Cancelled / RTO",
      isDispatched: false,
      isDelivered: false,
      isCancelled: true,
    };
  }

  if (/DELIVERED/.test(norm)) {
    return {
      stageId: "delivered",
      badge: "Delivered",
      isDispatched: true,
      isDelivered: true,
      isCancelled: false,
    };
  }

  if (/OUT FOR DELIVERY|OUT_FOR_DELIVERY/.test(norm)) {
    return {
      stageId: "delivered",
      badge: "Out for Delivery",
      isDispatched: true,
      isDelivered: false,
      isCancelled: false,
    };
  }

  if (/IN TRANSIT|IN_TRANSIT|SHIPPED|REACHED_AT_DESTINATION|PICKED UP|PICKED_UP/.test(norm)) {
    return {
      stageId: "delivered",
      badge: "In Transit",
      isDispatched: true,
      isDelivered: false,
      isCancelled: false,
    };
  }

  if (/PICKUP SCHEDULED|PICKUP_SCHEDULED|PICKUP GENERATED|MANIFEST_GENERATED|PACKED/.test(norm)) {
    return {
      stageId: "packed_dispatched",
      badge: "Ready for Pickup",
      isDispatched: false,
      isDelivered: false,
      isCancelled: false,
    };
  }

  // Fallback for new / pending
  return {
    stageId: "received",
    badge: "Order Received",
    isDispatched: false,
    isDelivered: false,
    isCancelled: false,
  };
}
