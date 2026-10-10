"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
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
import { ArrowLeftIcon, ChevronRightIcon, SecureLockIcon } from "@/components/customer/Icons";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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
  const { items, subtotal, totalCount, hasUnavailableItems, clearCart } = useCart();

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
  }>({ freeShippingThreshold: 999, defaultShippingFee: 50 });

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

  const shippingFee = subtotal >= storeSettings.freeShippingThreshold ? 0 : storeSettings.defaultShippingFee;
  const totalPayable = Math.max(0, subtotal + shippingFee);

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
        const orderPayload: any =
          selectedAddressId !== "new"
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
              };

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });

        const data = await res.json();

        if (res.ok && data.ok && data.order) {
          const createdOrder = data.order;

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

              await loadRazorpayScript();

              if (typeof (window as any).Razorpay === "undefined") {
                setIsProcessing(false);
                setAlertNotice("Unable to load payment gateway. Please refresh and try again.");
                return;
              }

              const options = {
                key: payData.keyId,
                amount: payData.amountInPaise,
                currency: payData.currency || "INR",
                name: "Dearr Store",
                description: `Order ${createdOrder.orderNumber}`,
                order_id: payData.razorpayOrderId,
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

                    // 2. Authoritative payment settlement
                    setAlertNotice("Finalizing order settlement...");
                    const settleRes = await fetch("/api/payments/settle", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId: createdOrder.id,
                        razorpay_order_id: paymentResp.razorpay_order_id,
                        razorpay_payment_id: paymentResp.razorpay_payment_id,
                      }),
                    });
                    const settleData = await settleRes.json();
                    if (!settleRes.ok || !settleData.ok) {
                      throw new Error(settleData.error || "Order settlement failed.");
                    }

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
                      adminOrder.orderNumber = createdOrder.orderNumber;
                      adminOrder.id = createdOrder.id;
                      adminOrder.paymentStatus = "paid";
                      saveAdminOrder(adminOrder);
                    } catch {}

                    await clearCart();
                    setIsProcessing(false);
                    router.push(`/order-confirmed?orderNumber=${createdOrder.orderNumber}`);
                  } catch (err: any) {
                    setIsProcessing(false);
                    setAlertNotice(err.message || "Payment verification failed. Please contact support.");
                  }
                },
                modal: {
                  ondismiss: async function () {
                    setIsProcessing(false);
                    setAlertNotice("Payment checkout was closed. Your order remains pending and can be completed anytime.");
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
                  },
                },
              };

              const rzp = new (window as any).Razorpay(options);
              (window as any).__lastRazorpayInstance = rzp;
              (window as any).__lastRazorpayOptions = options;

              rzp.on("payment.failed", async function (failResp: any) {
                setIsProcessing(false);
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
              });

              rzp.open();
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

          await clearCart();
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
  ]);

  // Reset to delivery step
  const handleReset = useCallback(() => {
    setCurrentStep("delivery");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Empty cart state
  if (items.length === 0 && currentStep !== "confirmation") {
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
                />
              </div>
            )}
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-5 w-full">
            <CheckoutSummary
              items={items}
              subtotal={subtotal}
              totalCount={totalCount}
              address={address}
              onEditAddress={() => setCurrentStep("delivery")}
              isProcessing={isProcessing}
              onProceedToPayment={handleProceedToPayment}
              isAddressValid={isAddressValidated}
              hasUnavailableItems={hasUnavailableItems}
              shippingFee={shippingFee}
              freeShippingThreshold={storeSettings.freeShippingThreshold}
              totalPayable={totalPayable}
              actionLabel={
                currentStep === "payment"
                  ? "Place Order & Pay via Razorpay"
                  : "Continue to Payment"
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
