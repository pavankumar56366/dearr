"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart, type CartItem } from "@/context/CartContext";
import {
  createAdminOrderFromCheckout,
  saveAdminOrder,
} from "@/lib/admin-orders";
import {
  validateDeliveryAddress,
  type DeliveryAddressFormValues,
  type DeliveryAddressErrors,
} from "@/lib/checkout-validation";
import CheckoutStepper, { type CheckoutStep } from "./CheckoutStepper";
import AddressForm, { type SavedAddressItem } from "./AddressForm";
import PaymentMethod, { type PaymentOption } from "./PaymentMethod";
import CheckoutSummary from "./CheckoutSummary";
import CheckoutEmptyState from "./CheckoutEmptyState";
import CheckoutDemoSuccess from "./CheckoutDemoSuccess";
import { CartRecoverySheet } from "./CartRecoverySheet";
import { ArrowLeftIcon, ChevronRightIcon, SecureLockIcon } from "@/components/customer/Icons";

const RAZORPAY_SCRIPT_ID = "razorpay-checkout-script";
const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const SCRIPT_LOAD_TIMEOUT_MS = 10000;

let razorpayScriptLoadingPromise: Promise<boolean> | null = null;

interface WindowWithRazorpay extends Window {
  Razorpay?: new (options: Record<string, unknown>) => {
    open: () => void;
    on: (event: string, callback: (response: unknown) => void) => void;
  };
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  const win = window as WindowWithRazorpay;

  // 1. If window.Razorpay is already available, return true immediately
  if (typeof win.Razorpay !== "undefined") {
    return Promise.resolve(true);
  }

  // 2. Return active singleton loading promise if already in-flight
  if (razorpayScriptLoadingPromise) {
    return razorpayScriptLoadingPromise;
  }

  razorpayScriptLoadingPromise = new Promise<boolean>((resolve) => {
    // Check if script element already exists in DOM
    let script = document.getElementById(RAZORPAY_SCRIPT_ID) as HTMLScriptElement | null;

    let timeoutId: NodeJS.Timeout | null = null;
    let pollIntervalId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (pollIntervalId) clearInterval(pollIntervalId);
    };

    const handleSuccess = () => {
      cleanup();
      // Ensure window.Razorpay constructor is definitely attached
      let attempts = 0;
      const verifyWindow = () => {
        if (typeof (window as WindowWithRazorpay).Razorpay !== "undefined") {
          resolve(true);
        } else if (attempts < 20) {
          attempts++;
          setTimeout(verifyWindow, 50);
        } else {
          resolve(typeof (window as WindowWithRazorpay).Razorpay !== "undefined");
        }
      };
      verifyWindow();
    };

    const handleFailure = () => {
      cleanup();
      const existing = document.getElementById(RAZORPAY_SCRIPT_ID);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      razorpayScriptLoadingPromise = null;
      resolve(false);
    };

    timeoutId = setTimeout(() => {
      console.warn(`[RazorpayLoader] Checkout script loading timed out after ${SCRIPT_LOAD_TIMEOUT_MS}ms`);
      handleFailure();
    }, SCRIPT_LOAD_TIMEOUT_MS);

    if (!script) {
      script = document.createElement("script");
      script.id = RAZORPAY_SCRIPT_ID;
      script.src = RAZORPAY_SCRIPT_SRC;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = handleSuccess;
      script.onerror = handleFailure;
      document.body.appendChild(script);
    } else {
      const scriptWithState = script as HTMLScriptElement & { readyState?: string };
      if (scriptWithState.readyState === "complete" || scriptWithState.readyState === "loaded") {
        handleSuccess();
      } else {
        script.addEventListener("load", handleSuccess, { once: true });
        script.addEventListener("error", handleFailure, { once: true });
        pollIntervalId = setInterval(() => {
          if (typeof (window as WindowWithRazorpay).Razorpay !== "undefined") {
            handleSuccess();
          }
        }, 100);
      }
    }
  });

  return razorpayScriptLoadingPromise;
}

const INITIAL_ADDRESS: DeliveryAddressFormValues = {
  fullName: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

export default function CheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intentId = searchParams.get("intentId");
  const { items, subtotal, discount, totalCount, hasUnavailableItems, clearCart } = useCart();

  const [intentData, setIntentData] = useState<any>(null);
  const [intentLoading, setIntentLoading] = useState<boolean>(Boolean(intentId));
  const [intentError, setIntentError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<CheckoutStep>("delivery");
  const [address, setAddress] = useState<DeliveryAddressFormValues>(INITIAL_ADDRESS);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressItem[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new");
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [errors, setErrors] = useState<DeliveryAddressErrors>({});
  const [isAddressValidated, setIsAddressValidated] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentOption>("razorpay");
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("DEAR-10001");
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const [storeSettings, setStoreSettings] = useState<{
    freeShippingThreshold: number;
    defaultShippingFee: number;
    codEnabled?: boolean;
    recoverySheetEnabled?: boolean;
    alternativesEnabled?: boolean;
    feedbackEnabled?: boolean;
    feedbackReasons?: string[];
  }>({ freeShippingThreshold: 999, defaultShippingFee: 50 });

  // Recovery sheet state
  const [showRecoverySheet, setShowRecoverySheet] = useState(false);
  const [recoveryAttemptId, setRecoveryAttemptId] = useState<string | null>(null);
  const [isRecoveryFailed, setIsRecoveryFailed] = useState(false);
  const [recoveryErrorCode, setRecoveryErrorCode] = useState<string | null>(null);
  const [recoveryErrorDesc, setRecoveryErrorDesc] = useState<string | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(intentId || null);

  // Preload Razorpay Checkout script ahead of time
  useEffect(() => {
    loadRazorpayScript().catch(() => {});
  }, []);

  useEffect(() => {
    if (currentStep === "payment") {
      loadRazorpayScript().catch(() => {});
    }
  }, [currentStep]);

  // Load Buy Now intent when intentId query is present
  useEffect(() => {
    if (!intentId) return;
    let isMounted = true;
    async function fetchIntent() {
      try {
        setIntentLoading(true);
        const res = await fetch(`/api/checkout/intent?intentId=${encodeURIComponent(intentId || "")}`);
        const data = await res.json();
        if (isMounted) {
          if (res.ok && data.ok && data.intent) {
            setIntentData(data.intent);
          } else {
            setIntentError(data.error || "Checkout session has expired or is invalid.");
          }
        }
      } catch {
        if (isMounted) {
          setIntentError("Failed to load checkout session.");
        }
      } finally {
        if (isMounted) {
          setIntentLoading(false);
        }
      }
    }
    fetchIntent();
    return () => {
      isMounted = false;
    };
  }, [intentId]);

  // Load public store settings for dynamic shipping calculations
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.ok && data.settings) {
            setStoreSettings({
              freeShippingThreshold: Number(data.settings.freeShippingThreshold ?? 999),
              defaultShippingFee: Number(data.settings.defaultShippingFee ?? 50),
              codEnabled: Boolean(data.settings.codEnabled),
              recoverySheetEnabled: data.settings.recoverySheetEnabled !== false,
              alternativesEnabled: data.settings.alternativesEnabled !== false,
              feedbackEnabled: data.settings.feedbackEnabled !== false,
              feedbackReasons: Array.isArray(data.settings.feedbackReasons)
                ? data.settings.feedbackReasons
                : undefined,
            });
          }
        }
      } catch {
        // Fallback to baseline defaults
      }
    }
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeItems: CartItem[] = useMemo(() => {
    if (intentData) {
      return (intentData.items || []).map((it: any) => ({
        id: it.id,
        productId: it.productId,
        slug: `product-${it.productId}`,
        name: it.productName,
        image: it.imageUrl || "/product-samples/1.jpeg",
        category: "3D Printing",
        price: it.unitPrice,
        compareAtPrice: null,
        quantity: it.quantity,
        stockQuantity: it.quantity,
        colorId: it.colorId || undefined,
        colorName: it.colorName || undefined,
        colorHex: it.colorHex || undefined,
        sku: it.sku || undefined,
        variantName: it.variantName || undefined,
        isActive: true,
        codEnabled: Boolean(it.codEnabled !== undefined ? it.codEnabled : true),
      }));
    }
    return items;
  }, [intentData, items]);

  const activeSubtotal = intentData ? intentData.subtotal : subtotal;
  const activeDiscount = intentData ? (Number(intentData.discountAmount) || 0) : (discount || 0);
  const activeTotalCount = intentData
    ? (intentData.items || []).reduce((count: number, it: any) => count + it.quantity, 0)
    : totalCount;
  const activeShippingFee = intentData
    ? intentData.shippingAmount
    : (activeSubtotal >= storeSettings.freeShippingThreshold ? 0 : storeSettings.defaultShippingFee);
  const activeTotalPayable = intentData
    ? intentData.totalAmount
    : Math.max(0, activeSubtotal - activeDiscount + activeShippingFee);

  const isCodMasterEnabled = Boolean(storeSettings.codEnabled);
  const areItemsCodEligible = useMemo(() => {
    if (intentData) {
      if (typeof intentData.isCodEligible === "boolean") {
        return intentData.isCodEligible;
      }
      return (intentData.items || []).every((it: any) => it.codEnabled !== false);
    }
    return items.length > 0 && items.every((it) => it.codEnabled !== false);
  }, [intentData, items]);

  const isCodAvailable = isCodMasterEnabled && areItemsCodEligible;

  const codUnavailableReason = useMemo(() => {
    if (!isCodMasterEnabled) {
      return "Cash on Delivery is currently disabled for this store. Please complete checkout using online payment.";
    }
    if (!areItemsCodEligible) {
      return "One or more items in your cart are not eligible for Cash on Delivery. Online payment is required.";
    }
    return undefined;
  }, [isCodMasterEnabled, areItemsCodEligible]);

  useEffect(() => {
    if (paymentMethod === "cod" && !isCodAvailable) {
      setPaymentMethod("razorpay");
    }
  }, [paymentMethod, isCodAvailable]);

  // Pre-load Razorpay checkout script & fetch customer saved addresses
  useEffect(() => {
    loadRazorpayScript();

    let isMounted = true;
    async function fetchSavedAddresses() {
      try {
        const res = await fetch("/api/customer/addresses");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.ok && Array.isArray(data.addresses) && data.addresses.length > 0) {
          setSavedAddresses(data.addresses);
          const defaultAddr = data.addresses.find((a: SavedAddressItem) => a.isDefault) || data.addresses[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            setAddress((prev) => ({
              ...prev,
              fullName: defaultAddr.fullName,
              phone: defaultAddr.phone,
              addressLine1: defaultAddr.addressLine1,
              addressLine2: defaultAddr.addressLine2 || "",
              city: defaultAddr.city,
              state: defaultAddr.state,
              postalCode: defaultAddr.postalCode,
              country: defaultAddr.country || "India",
            }));
            setIsAddressValidated(true);
          }
        }
      } catch (err) {
        // Unauthenticated or network error — fall back to manual address entry
      }
    }
    fetchSavedAddresses();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle switching between saved addresses or new address form
  const handleSelectSavedAddress = useCallback(
    (addrId: string | "new") => {
      setSelectedAddressId(addrId);
      if (addrId === "new") {
        setAddress(INITIAL_ADDRESS);
        setErrors({});
        setIsAddressValidated(false);
      } else {
        const selected = savedAddresses.find((a) => a.id === addrId);
        if (selected) {
          setAddress((prev) => ({
            ...prev,
            fullName: selected.fullName,
            phone: selected.phone,
            addressLine1: selected.addressLine1,
            addressLine2: selected.addressLine2 || "",
            city: selected.city,
            state: selected.state,
            postalCode: selected.postalCode,
            country: selected.country || "India",
          }));
          setErrors({});
          setIsAddressValidated(true);
        }
      }
    },
    [savedAddresses]
  );

  // Field change handler for new address form
  const handleAddressChange = useCallback((field: keyof DeliveryAddressFormValues, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    // Clear inline error when customer types
    setErrors((prev) => {
      if (prev[field]) {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      }
      return prev;
    });
  }, []);

  // Address form submission
  const handleAddressSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (selectedAddressId !== "new") {
        // Saved address already selected and verified
        setIsAddressValidated(true);
        setCurrentStep("payment");
        setAlertNotice("Delivery address selected! Proceeding to payment step.");
        setTimeout(() => setAlertNotice(null), 3000);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const result = validateDeliveryAddress(address);
      if (!result.success) {
        setErrors(result.errors);
        setIsAddressValidated(false);
        setAlertNotice("Please resolve the highlighted delivery details before continuing.");
        setTimeout(() => setAlertNotice(null), 4000);
        return;
      }

      setErrors({});
      setIsAddressValidated(true);
      setCurrentStep("payment");
      setAlertNotice("Delivery address verified! Proceeding to payment step.");
      setTimeout(() => setAlertNotice(null), 3000);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [address, selectedAddressId]
  );

  // Proceed to payment / Place Order
  const handleProceedToPayment = useCallback(() => {
    if (isProcessing) return;

    // 1. If currently on delivery step, validate address and move to payment step
    if (currentStep === "delivery") {
      if (selectedAddressId !== "new") {
        setIsAddressValidated(true);
        setCurrentStep("payment");
        setAlertNotice("Delivery address selected! Proceeding to payment step.");
        setTimeout(() => setAlertNotice(null), 3000);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const result = validateDeliveryAddress(address);
      if (!result.success) {
        setErrors(result.errors);
        setIsAddressValidated(false);
        setAlertNotice("Please complete your delivery address first.");
        setTimeout(() => setAlertNotice(null), 4000);
        return;
      }
      setErrors({});
      setIsAddressValidated(true);
      setCurrentStep("payment");
      setAlertNotice("Delivery address verified! Proceeding to payment step.");
      setTimeout(() => setAlertNotice(null), 3000);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // 2. Re-validate delivery address if on payment step
    if (selectedAddressId === "new") {
      const result = validateDeliveryAddress(address);
      if (!result.success) {
        setErrors(result.errors);
        setIsAddressValidated(false);
        setCurrentStep("delivery");
        setAlertNotice("Please complete your delivery address first.");
        setTimeout(() => setAlertNotice(null), 4000);
        return;
      }
    }

    // 3. Prevent checkout if empty or unavailable items
    if (items.length === 0) {
      setAlertNotice("Cannot proceed with an empty cart.");
      setTimeout(() => setAlertNotice(null), 3000);
      return;
    }

    if (hasUnavailableItems) {
      setAlertNotice("Cannot proceed while out-of-stock items exist in the cart.");
      setTimeout(() => setAlertNotice(null), 4000);
      return;
    }

    // 4. Server-authoritative Order API call
    setIsProcessing(true);

    (async () => {
      try {
        const currentAttempt = activeAttemptId || intentId || undefined;
        const orderPayload: any = {
          paymentMethod,
          ...(selectedAddressId !== "new"
            ? { addressId: selectedAddressId }
            : {
                shippingFullName: address.fullName,
                shippingPhone: address.phone,
                shippingAddressLine1: address.addressLine1,
                shippingAddressLine2: address.addressLine2 || null,
                shippingCity: address.city,
                shippingState: address.state,
                shippingPostalCode: address.postalCode,
                shippingCountry: address.country || "India",
                saveAddress: saveNewAddress,
              }),
          ...(currentAttempt ? { intentId: currentAttempt, attemptId: currentAttempt } : {}),
          ...(intentId && intentData?.items ? { isBuyNow: true, items: intentData.items } : {}),
        };

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });

        const data = await res.json();

        if (res.ok && data.ok && data.order) {
          const createdOrder = data.order;
          const returnedAttemptId = data.attemptId || (data.isAttempt ? createdOrder.id : null);
          if (returnedAttemptId) {
            setActiveAttemptId(returnedAttemptId);
          }

          if (paymentMethod === "razorpay") {
            try {
              setAlertNotice("Initializing secure payment...");
              const payRes = await fetch("/api/payments/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: createdOrder.id }),
              });
              const payData = await payRes.json();

              if (!payRes.ok || !payData.ok) {
                setIsProcessing(false);
                setAlertNotice(payData.error || "Failed to initialize payment. Please try again.");
                return;
              }

              const scriptLoaded = await loadRazorpayScript();

              if (!scriptLoaded || typeof (window as WindowWithRazorpay).Razorpay === "undefined") {
                setIsProcessing(false);
                setAlertNotice(
                  "Unable to connect to payment gateway. Please check your internet connection and try again."
                );
                return;
              }

              const options = {
                key: payData.keyId,
                amount: payData.amountInPaise,
                currency: payData.currency || "INR",
                name: "Dearr Store",
                description: `Order ${createdOrder.orderNumber}`,
                order_id: payData.razorpayOrderId,
                notes: {
                  attemptId: createdOrder.id,
                  orderId: createdOrder.id,
                },
                _attemptId: createdOrder.id,
                prefill: {
                  name: address.fullName,
                  email: address.email,
                  contact: address.phone,
                },
                theme: {
                  color: "#2A7C13",
                },
                handler: async function (paymentResp: any) {
                  try {
                    setIsProcessing(true);
                    setAlertNotice("Verifying payment with gateway...");

                    // 1. Cryptographic HMAC signature verification
                    const verifyRes = await fetch("/api/payments/verify", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId: createdOrder.id,
                        razorpay_order_id: paymentResp.razorpay_order_id,
                        razorpay_payment_id: paymentResp.razorpay_payment_id,
                        razorpay_signature: paymentResp.razorpay_signature,
                      }),
                    });
                    const verifyData = await verifyRes.json();
                    if (!verifyRes.ok || !verifyData.ok) {
                      throw new Error(verifyData.error || "Payment signature verification failed.");
                    }

                    // 2. Authoritative payment settlement confirmation
                    setAlertNotice("Finalizing order settlement...");
                    let settleData: any = {};
                    try {
                      const settleRes = await fetch("/api/payments/settle", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          orderId: createdOrder.id,
                          razorpay_order_id: paymentResp.razorpay_order_id,
                          razorpay_payment_id: paymentResp.razorpay_payment_id,
                        }),
                      });
                      settleData = await settleRes.json();
                    } catch {
                      // Fallback: verification already finalized the order
                    }

                    const finalOrderNumber =
                      verifyData.orderNumber ||
                      settleData.orderNumber ||
                      createdOrder.orderNumber;
                    const finalOrderId =
                      verifyData.orderId ||
                      settleData.orderId ||
                      createdOrder.id;

                    // Sync admin/local session store
                    try {
                      const adminOrder = createAdminOrderFromCheckout({
                        items,
                        customer: {
                          name: address.fullName,
                          email: address.email,
                          phone: address.phone,
                        },
                        shippingAddress: {
                          fullName: address.fullName,
                          phone: address.phone,
                          addressLine1: address.addressLine1,
                          addressLine2: address.addressLine2,
                          city: address.city,
                          state: address.state,
                          postalCode: address.postalCode,
                          country: address.country || "India",
                        },
                        subtotal: createdOrder.subtotal,
                        discountAmount: createdOrder.discountAmount,
                        shippingAmount: createdOrder.shippingAmount,
                        paymentMethod: "Razorpay (Paid)",
                      });
                      adminOrder.orderNumber = finalOrderNumber;
                      adminOrder.id = finalOrderId;
                      adminOrder.paymentStatus = "paid";
                      saveAdminOrder(adminOrder);
                    } catch {}

                    if (!intentId) {
                      await clearCart();
                    }
                    setIsProcessing(false);
                    router.push(`/order-confirmed?orderNumber=${finalOrderNumber}`);
                  } catch (err: any) {
                    setIsProcessing(false);
                    setAlertNotice(err.message || "Payment verification failed. Please contact support.");
                  }
                },
                modal: {
                  ondismiss: async function () {
                    setIsProcessing(false);
                    setAlertNotice("Payment checkout was closed. Your cart remains saved so you can complete your purchase anytime.");
                    try {
                      await fetch("/api/payments/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          orderId: createdOrder.id,
                          razorpay_order_id: payData.razorpayOrderId,
                        }),
                      });
                    } catch {}

                    const targetAttemptId = data.attemptId || (data.isAttempt ? createdOrder.id : null);
                    if (targetAttemptId) {
                      try {
                        const dismissRes = await fetch(`/api/checkout/attempts/${targetAttemptId}/dismissed`, {
                          method: "POST",
                        });
                        const dismissData = await dismissRes.json();
                        if (dismissData.isPaid && dismissData.orderNumber) {
                          router.push(`/order-confirmed?orderNumber=${dismissData.orderNumber}`);
                          return;
                        }

                        const statRes = await fetch(`/api/checkout/attempts/${targetAttemptId}/recovery-status`);
                        const statData = await statRes.json();
                        if (statData.isPaid && statData.orderNumber) {
                          router.push(`/order-confirmed?orderNumber=${statData.orderNumber}`);
                          return;
                        }
                        if (statData.eligible) {
                          setRecoveryAttemptId(targetAttemptId);
                          setIsRecoveryFailed(false);
                          setRecoveryErrorCode(null);
                          setRecoveryErrorDesc(null);
                          setShowRecoverySheet(true);
                        }
                      } catch {}
                    }
                  },
                },
              };

              const rzp = new (window as any).Razorpay(options);
              (window as any).__lastRazorpayInstance = rzp;
              (window as any).__lastRazorpayOptions = options;

              rzp.on("payment.failed", async function (failResp: any) {
                setIsProcessing(false);
                const errorCode = failResp?.error?.code || null;
                const desc =
                  failResp?.error?.description ||
                  "Payment failed. Your order remains safely pending.";
                setAlertNotice(desc);
                try {
                  await fetch("/api/payments/fail", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      orderId: createdOrder.id,
                      razorpay_order_id: payData.razorpayOrderId,
                      error: failResp?.error,
                    }),
                  });
                } catch {}

                const targetAttemptId = data.attemptId || (data.isAttempt ? createdOrder.id : null);
                if (targetAttemptId) {
                  try {
                    const failRes = await fetch(`/api/checkout/attempts/${targetAttemptId}/failed`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        code: errorCode,
                        description: desc,
                        source: failResp?.error?.source,
                        step: failResp?.error?.step,
                        reason: failResp?.error?.reason,
                      }),
                    });
                    const failData = await failRes.json();
                    if (failData.isPaid && failData.orderNumber) {
                      router.push(`/order-confirmed?orderNumber=${failData.orderNumber}`);
                      return;
                    }

                    const statRes = await fetch(`/api/checkout/attempts/${targetAttemptId}/recovery-status`);
                    const statData = await statRes.json();
                    if (statData.isPaid && statData.orderNumber) {
                      router.push(`/order-confirmed?orderNumber=${statData.orderNumber}`);
                      return;
                    }
                    if (statData.eligible) {
                      setRecoveryAttemptId(targetAttemptId);
                      setIsRecoveryFailed(true);
                      setRecoveryErrorCode(errorCode);
                      setRecoveryErrorDesc(desc);
                      setShowRecoverySheet(true);
                    }
                  } catch {}
                }
              });

              rzp.open();
              const targetAttemptId = data.attemptId || (data.isAttempt ? createdOrder.id : null);
              if (targetAttemptId) {
                fetch(`/api/checkout/attempts/${targetAttemptId}/opened`, { method: "POST" }).catch(() => {});
              }
              setIsProcessing(false);
              return;
            } catch (err: any) {
              setIsProcessing(false);
              setAlertNotice(err.message || "Payment service encounter an error. Please try again.");
              return;
            }
          }

          // Non-Razorpay / COD
          try {
            const adminOrder = createAdminOrderFromCheckout({
              items,
              customer: {
                name: address.fullName,
                email: address.email,
                phone: address.phone,
              },
              shippingAddress: {
                fullName: address.fullName,
                phone: address.phone,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country || "India",
              },
              subtotal: createdOrder.subtotal,
              discountAmount: createdOrder.discountAmount,
              shippingAmount: createdOrder.shippingAmount,
              paymentMethod: paymentMethod === "cod" ? "Cash on Delivery" : "Prepaid",
            });
            adminOrder.orderNumber = createdOrder.orderNumber;
            adminOrder.id = createdOrder.id;
            saveAdminOrder(adminOrder);
          } catch {}

          if (!intentId) {
            await clearCart();
          }
          setIsProcessing(false);
          router.push(`/order-confirmed?orderNumber=${createdOrder.orderNumber}`);
          return;
        }

        // If guest/unauthenticated (401), redirect to login with cart preserved
        if (res.status === 401) {
          setIsProcessing(false);
          router.push("/login?redirect=/checkout");
          return;
        }

        // Real API error (e.g. 400 Insufficient stock)
        setIsProcessing(false);
        setAlertNotice(data.error || "Failed to create order. Please try again.");
      } catch (err: any) {
        console.error("Order creation network error:", err);
        setIsProcessing(false);
        setAlertNotice("Network error while creating order. Please check your connection and try again.");
      }
    })();
  }, [
    isProcessing,
    currentStep,
    selectedAddressId,
    address,
    saveNewAddress,
    items,
    paymentMethod,
    hasUnavailableItems,
    clearCart,
    router,
    activeAttemptId,
    intentId,
  ]);

  // Reset to delivery step
  const handleReset = useCallback(() => {
    setCurrentStep("delivery");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (intentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-neutral-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-semibold">Preparing your checkout...</p>
        </div>
      </div>
    );
  }

  if (intentError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-neutral-600">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-neutral-200 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xl">!</div>
          <h2 className="text-lg font-bold text-neutral-900">Checkout Session Expired</h2>
          <p className="text-xs text-neutral-600">{intentError}</p>
          <Link href="/" className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition">
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  // Empty cart state
  if (activeItems.length === 0 && currentStep !== "confirmation") {
    return (
      <div
        className="min-h-screen pb-32 md:pb-20"
        style={{ background: "var(--color-canvas)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <nav aria-label="Breadcrumb" className="pb-4">
            <ol className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <li>
                <Link href="/" className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary">Home</Link>
              </li>
              <li aria-hidden="true" className="text-neutral-400">
                <ChevronRightIcon size={12} />
              </li>
              <li>
                <Link href="/cart" className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary">Cart</Link>
              </li>
              <li aria-hidden="true" className="text-neutral-400">
                <ChevronRightIcon size={12} />
              </li>
              <li aria-current="page" className="font-bold text-neutral-800">
                Checkout
              </li>
            </ol>
          </nav>

          <CheckoutEmptyState />
        </div>
      </div>
    );
  }

  // Confirmation preview state
  if (currentStep === "confirmation") {
    return (
      <div
        className="min-h-screen pb-32 md:pb-20"
        style={{ background: "var(--color-canvas)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <CheckoutStepper
            currentStep="confirmation"
            canNavigateToPayment={true}
            onStepClick={setCurrentStep}
          />
          <CheckoutDemoSuccess
            orderNumber={orderNumber}
            items={items}
            subtotal={subtotal}
            totalCount={totalCount}
            address={address}
            onReset={handleReset}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-32 md:pb-20"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* Accessible Status Notice */}
      {alertNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200"
          style={{
            background: "var(--color-neutral-900)",
            color: "#FFFFFF",
            maxWidth: "92vw",
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
          <span className="truncate">{alertNotice}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="pb-4">
          <ol className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <li>
              <Link href="/" className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary">Home</Link>
            </li>
            <li aria-hidden="true" className="text-neutral-400">
              <ChevronRightIcon size={12} />
            </li>
            <li>
              <Link href="/cart" className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary">Cart</Link>
            </li>
            <li aria-hidden="true" className="text-neutral-400">
              <ChevronRightIcon size={12} />
            </li>
            <li aria-current="page" className="font-bold text-neutral-800">
              Checkout
            </li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--color-neutral-900)" }}
            >
              Secure Customer Checkout
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1">
              Precision 3D print fulfillment · Domestic shipping across India
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <SecureLockIcon size={14} className="text-emerald-700" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>

        {/* Progress Stepper */}
        <CheckoutStepper
          currentStep={currentStep}
          canNavigateToPayment={isAddressValidated}
          onStepClick={(step) => {
            if (step === "delivery") setCurrentStep("delivery");
            if (step === "payment" && isAddressValidated) setCurrentStep("payment");
          }}
        />

        {/* Responsive Two-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Flow Steps (Address or Payment) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {currentStep === "delivery" && (
              <AddressForm
                savedAddresses={savedAddresses}
                selectedAddressId={selectedAddressId}
                onSelectSavedAddress={handleSelectSavedAddress}
                values={address}
                errors={errors}
                onChange={handleAddressChange}
                onSubmit={handleAddressSubmit}
                isValidated={isAddressValidated}
                saveNewAddress={saveNewAddress}
                onToggleSaveNewAddress={setSaveNewAddress}
              />
            )}

            {currentStep === "payment" && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-200">
                {/* Back to Address Link */}
                <button
                  type="button"
                  onClick={() => setCurrentStep("delivery")}
                  className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 transition-colors self-start"
                >
                  <ArrowLeftIcon size={14} />
                  <span>← Back to Delivery Details</span>
                </button>

                <PaymentMethod
                  selectedMethod={paymentMethod}
                  onSelectMethod={setPaymentMethod}
                  codAvailable={isCodAvailable}
                  codUnavailableReason={codUnavailableReason}
                />
              </div>
            )}
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-5 w-full">
            <CheckoutSummary
              items={activeItems}
              subtotal={activeSubtotal}
              totalCount={activeTotalCount}
              address={address}
              onEditAddress={() => setCurrentStep("delivery")}
              isProcessing={isProcessing}
              onProceedToPayment={handleProceedToPayment}
              isAddressValid={isAddressValidated}
              hasUnavailableItems={hasUnavailableItems}
              shippingFee={activeShippingFee}
              freeShippingThreshold={storeSettings.freeShippingThreshold}
              totalPayable={activeTotalPayable}
              discount={activeDiscount}
              actionLabel={
                currentStep === "payment"
                  ? paymentMethod === "cod"
                    ? "Place Order (Cash on Delivery)"
                    : "Place Order & Pay via Razorpay"
                  : "Continue to Payment"
              }
            />
          </div>
        </div>
      </main>

      {/* Cart Abandonment / Payment Failure Recovery Sheet */}
      {recoveryAttemptId && (
        <CartRecoverySheet
          isOpen={showRecoverySheet}
          attemptId={recoveryAttemptId}
          isFailed={isRecoveryFailed}
          errorCode={recoveryErrorCode}
          errorDescription={recoveryErrorDesc}
          customerEmail={address.email}
          customerPhone={address.phone}
          defaultReasons={storeSettings.feedbackReasons}
          onClose={() => setShowRecoverySheet(false)}
          onRetryPayment={() => {
            setShowRecoverySheet(false);
            handleProceedToPayment();
          }}
          onCartSwapped={() => {
            setShowRecoverySheet(false);
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
        />
      )}
    </div>
  );
}
