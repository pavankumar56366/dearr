"use client";

import React, { useState, useEffect } from "react";
import {
  MapPinIcon,
  TruckIcon,
  CheckIcon,
  AlertCircleIcon,
} from "@/components/customer/Icons";

const STORAGE_KEY = "dearr_delivery_pincode";

interface CourierOption {
  courierCompanyId: number;
  courierName: string;
  rate?: number;
  etd?: string;
  estimatedDeliveryDays?: string | number;
  cod?: number;
  rating?: number;
}

interface ServiceabilityData {
  serviceable: boolean;
  deliveryPincode: string;
  estimatedDeliveryDays?: number | string;
  estimatedDeliveryText?: string;
  recommendedCourier?: string;
  availableCouriers?: CourierOption[];
  message?: string;
}

interface PincodeServiceabilityWidgetProps {
  productWeightKg?: number;
  dispatchLeadDays?: number;
  dispatchTimelineText?: string;
  className?: string;
}

export function PincodeServiceabilityWidget({
  productWeightKg = 0.5,
  dispatchLeadDays,
  dispatchTimelineText,
  className = "",
}: PincodeServiceabilityWidgetProps) {
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ServiceabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check deliverability against server API
  const checkPincode = async (code: string) => {
    const clean = code.trim().replace(/\D/g, "");
    if (!/^[1-9][0-9]{5}$/.test(clean)) {
      setError("Please enter a valid 6-digit Indian PIN code");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/shipping/serviceability?pincode=${encodeURIComponent(
          clean
        )}&weight=${encodeURIComponent(productWeightKg)}`
      );
      const data = await res.json();

      if (res.ok && data.ok) {
        setResult(data);
        setError(null);
        try {
          localStorage.setItem(STORAGE_KEY, clean);
        } catch {
          // Ignore localStorage errors
        }
      } else {
        setError(data?.error || "Unable to check serviceability for this PIN code.");
        setResult(null);
      }
    } catch (err) {
      console.error("[Pincode Serviceability Check Error]", err);
      setError("Connection error. Standard delivery is available across India.");
      setResult({
        serviceable: true,
        deliveryPincode: clean,
        estimatedDeliveryText: "3 to 5 business days",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load saved PIN code on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^[1-9][0-9]{5}$/.test(saved)) {
        setPincode(saved);
        checkPincode(saved);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkPincode(pincode);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setPincode("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Calculate estimated delivery date
  const getEstimatedDateText = () => {
    if (result?.estimatedDeliveryText) {
      return result.estimatedDeliveryText;
    }
    const days = Number(result?.estimatedDeliveryDays) || 3;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    return targetDate.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${className}`}
      style={{
        background: "var(--color-surface, #ffffff)",
        borderColor: "var(--color-neutral-200, #e5e5e5)",
      }}
    >
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
          <TruckIcon size={15} className="text-primary" />
          <span>Delivery & Serviceability</span>
        </span>
        {result && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 underline transition cursor-pointer"
          >
            Change
          </button>
        )}
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MapPinIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
              <input
                type="text"
                value={pincode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPincode(val);
                  if (error) setError(null);
                }}
                placeholder="Enter 6-digit delivery PIN"
                maxLength={6}
                aria-label="Delivery PIN code"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-300 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading || pincode.length !== 6}
              className="h-10 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-neutral-900 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Check"
              )}
            </button>
          </div>

          {error && (
            <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 pt-0.5">
              <AlertCircleIcon size={12} className="shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <p className="text-[11px] text-neutral-400 flex items-center gap-1">
            <span>Enter your PIN code to check courier serviceability and estimated arrival.</span>
          </p>
        </form>
      ) : (
        <div className="mt-3 space-y-2">
          {result.serviceable ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CheckIcon size={11} />
                  </span>
                  <span>Delivery available to {result.deliveryPincode}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Serviceable
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-100 text-neutral-700 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500">Estimated Delivery:</span>
                  <span className="font-bold text-neutral-900">
                    {getEstimatedDateText()}
                  </span>
                </div>
                {result.recommendedCourier && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500">Courier Partner:</span>
                    <span className="font-semibold text-neutral-800">
                      {result.recommendedCourier}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500">Dispatch Speed:</span>
                  <span className="font-semibold text-emerald-700">
                    {dispatchTimelineText ||
                      (dispatchLeadDays
                        ? `Ships in ${dispatchLeadDays} business days`
                        : "Dispatched in 2–3 business days")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-neutral-500 pt-1">
                <span className="flex items-center gap-1">
                  <span className="text-emerald-600 font-bold">✓</span> Free Shipping Eligible
                </span>
                <span className="text-neutral-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-emerald-600 font-bold">✓</span> Real-Time Tracking
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircleIcon size={14} className="text-amber-600 shrink-0" />
                <span>Limited courier reach for {result.deliveryPincode}</span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Standard parcel shipping may take 5–7 business days to this location.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
