"use client";

import React, { useState, useEffect } from "react";
import {
  PackageIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CopyIcon,
  ClockIcon,
} from "../AdminIcons";

interface AdminShiprocketCardProps {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  totalAmount: number;
  onStatusUpdated?: () => void;
  onShowToast?: (msg: string) => void;
}

interface ShipmentData {
  id?: string;
  order_id?: string;
  shiprocket_order_id?: string;
  shiprocket_shipment_id?: string;
  awb_code?: string;
  courier_id?: number;
  courier_name?: string;
  status?: string;
  pickup_location?: string;
  pickup_scheduled_date?: string;
  pickup_token?: string;
  etd?: string;
  label_url?: string;
  manifest_url?: string;
  tracking_url?: string;
  last_tracking_activity?: string;
  last_tracking_at?: string;
}

interface LiveTrackingScan {
  date: string;
  status: string;
  activity: string;
  location: string;
}

interface LiveTrackingData {
  trackStatus?: number;
  currentStatus?: string;
  courierName?: string;
  awbCode?: string;
  edd?: string;
  deliveredDate?: string;
  scans?: LiveTrackingScan[];
  error?: string;
}

interface AvailableCourier {
  courierCompanyId: number;
  courierName: string;
  rate: number;
  estimatedDeliveryDays: number | string;
  rating?: number;
}

interface FreightAccounting {
  customerShippingFee: number;
  customerShippingCharged: number;
  codFeeAmount: number;
  codFeeCharged: number;
  totalShippingCollected: number;
  actualFreightCost: number | null;
  actualCourierCost: number | null;
  netFreightMargin: number | null;
  shippingMargin: number | null;
}

export function AdminShiprocketCard({
  orderId,
  orderNumber,
  orderStatus,
  totalAmount,
  onStatusUpdated,
  onShowToast,
}: AdminShiprocketCardProps) {
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [liveTracking, setLiveTracking] = useState<LiveTrackingData | null>(null);
  const [availableCouriers, setAvailableCouriers] = useState<AvailableCourier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [confirmHigherCost, setConfirmHigherCost] = useState(false);
  const [freightAccounting, setFreightAccounting] = useState<FreightAccounting | null>(null);

  // Action states
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [generatingAwb, setGeneratingAwb] = useState(false);
  const [requestingPickup, setRequestingPickup] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [generatingManifest, setGeneratingManifest] = useState(false);
  const [refreshingTracking, setRefreshingTracking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parcel inputs
  const [weightKg, setWeightKg] = useState("0.5");
  const [pickupLocation, setPickupLocation] = useState("Primary");
  const [showConfigModal, setShowConfigModal] = useState(false);

  const fetchShipmentStatus = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`
      );
      if (res.ok) {
        const data = await res.json();
        setIsConfigured(Boolean(data.isConfigured));
        setIsEnabled(Boolean(data.isEnabled));
        if (data.shipment) {
          setShipment(data.shipment);
        } else if (data.orderAwb) {
          setShipment({
            awb_code: data.orderAwb,
            courier_name: data.courierName,
            status: "AWB_ASSIGNED",
          });
        }
        if (data.liveTracking) {
          setLiveTracking(data.liveTracking);
        }
        if (data.availableCouriers && Array.isArray(data.availableCouriers)) {
          setAvailableCouriers(data.availableCouriers);
        }
        if (data.freightAccounting) {
          const customerShipping = Number(data.freightAccounting.customerShippingCharged ?? data.freightAccounting.customerShippingFee ?? 0);
          const codFee = Number(data.freightAccounting.codFeeCharged ?? data.freightAccounting.codFeeAmount ?? 0);
          const actualCost = data.freightAccounting.actualCourierCost != null ? Number(data.freightAccounting.actualCourierCost) : (data.freightAccounting.actualFreightCost != null ? Number(data.freightAccounting.actualFreightCost) : null);
          const margin = data.freightAccounting.shippingMargin != null ? Number(data.freightAccounting.shippingMargin) : (data.freightAccounting.netFreightMargin != null ? Number(data.freightAccounting.netFreightMargin) : null);

          setFreightAccounting({
            customerShippingFee: customerShipping,
            customerShippingCharged: customerShipping,
            codFeeAmount: codFee,
            codFeeCharged: codFee,
            totalShippingCollected: customerShipping + codFee,
            actualFreightCost: actualCost,
            actualCourierCost: actualCost,
            netFreightMargin: margin,
            shippingMargin: margin,
          });
        }
      }
    } catch (err: any) {
      console.error("[AdminShiprocketCard Fetch Error]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipmentStatus();
  }, [orderId]);

  const notify = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  // 1. Create Order on Shiprocket
  const handleCreateOrder = async () => {
    setCreatingOrder(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_order",
            weightKg: parseFloat(weightKg) || 0.5,
            pickupLocation: pickupLocation || "Primary",
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.ok) {
        notify("✓ Shiprocket order created successfully!");
        setShowConfigModal(false);
        await fetchShipmentStatus();
        if (onStatusUpdated) onStatusUpdated();
      } else {
        setErrorMessage(data?.error || "Failed to create order on Shiprocket.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error while contacting Shiprocket.");
    } finally {
      setCreatingOrder(false);
    }
  };

  // 2. Generate AWB
  const handleGenerateAWB = async () => {
    const shipmentId = shipment?.shiprocket_shipment_id;
    if (!shipmentId) {
      setErrorMessage("No shipment ID found. Please create the Shiprocket order first.");
      return;
    }

    const chosenCourier = availableCouriers.find(
      (c) => String(c.courierCompanyId) === selectedCourierId
    );
    const courierId = chosenCourier ? chosenCourier.courierCompanyId : undefined;
    const actualCost = chosenCourier ? chosenCourier.rate : undefined;
    const customerFreight = freightAccounting?.customerShippingCharged ?? 0;
    const isHigherCost = Boolean(chosenCourier && chosenCourier.rate > customerFreight);

    if (isHigherCost && !confirmHigherCost) {
      setErrorMessage(
        `Selected courier costs ₹${chosenCourier?.rate.toFixed(2)}, which is higher than the customer quote of ₹${customerFreight.toFixed(2)}. Please confirm to proceed.`
      );
      return;
    }

    setGeneratingAwb(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_awb",
            shipmentId: Number(shipmentId),
            courierId,
            actualCost,
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.ok) {
        notify(`✓ AWB ${data.awbCode} generated with ${data.courierName}!`);
        await fetchShipmentStatus();
        if (onStatusUpdated) onStatusUpdated();
      } else {
        setErrorMessage(data?.error || "Failed to generate AWB.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error while generating AWB.");
    } finally {
      setGeneratingAwb(false);
    }
  };

  // 3. Request Pickup
  const handleRequestPickup = async () => {
    const shipmentId = shipment?.shiprocket_shipment_id;
    if (!shipmentId) return;

    setRequestingPickup(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request_pickup",
            shipmentId: Number(shipmentId),
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.ok) {
        notify("✓ Courier pickup requested successfully!");
        await fetchShipmentStatus();
      } else {
        setErrorMessage(data?.error || "Failed to schedule pickup.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error while scheduling pickup.");
    } finally {
      setRequestingPickup(false);
    }
  };

  // 4. Generate & Print Shipping Label
  const handlePrintLabel = async () => {
    if (shipment?.label_url) {
      window.open(shipment.label_url, "_blank");
      return;
    }

    const shipmentId = shipment?.shiprocket_shipment_id;
    if (!shipmentId) return;

    setGeneratingLabel(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_label",
            shipmentId: Number(shipmentId),
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.ok && data.labelUrl) {
        notify("✓ Label generated! Opening in new tab...");
        window.open(data.labelUrl, "_blank");
        await fetchShipmentStatus();
      } else {
        setErrorMessage(data?.error || "Failed to generate shipping label PDF.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error while generating label.");
    } finally {
      setGeneratingLabel(false);
    }
  };

  // 5. Generate Manifest
  const handlePrintManifest = async () => {
    if (shipment?.manifest_url) {
      window.open(shipment.manifest_url, "_blank");
      return;
    }

    const shipmentId = shipment?.shiprocket_shipment_id;
    if (!shipmentId) return;

    setGeneratingManifest(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_manifest",
            shipmentId: Number(shipmentId),
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.ok && data.manifestUrl) {
        notify("✓ Manifest generated! Opening in new tab...");
        window.open(data.manifestUrl, "_blank");
        await fetchShipmentStatus();
      } else {
        setErrorMessage(data?.error || "Failed to generate manifest PDF.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error while generating manifest.");
    } finally {
      setGeneratingManifest(false);
    }
  };

  // 6. Refresh Tracking
  const handleRefreshTracking = async () => {
    setRefreshingTracking(true);
    await fetchShipmentStatus();
    setRefreshingTracking(false);
    notify("✓ Live tracking status updated.");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    notify(`Copied ${label} to clipboard!`);
  };

  const hasShipment = Boolean(
    shipment?.shiprocket_shipment_id || shipment?.shiprocket_order_id
  );
  const hasAwb = Boolean(shipment?.awb_code);
  const isPickupScheduled = Boolean(shipment?.pickup_scheduled_date || shipment?.pickup_token);

  return (
    <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-200">
            SR
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Shiprocket Logistics
            </h3>
            <span className="text-[10px] text-neutral-500">
              Courier fulfillment & live dispatch
            </span>
          </div>
        </div>

        {hasAwb && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircleIcon size={12} />
            <span>AWB Active</span>
          </span>
        )}
      </div>

      {/* Warnings & Errors */}
      {(!isConfigured || !isEnabled) && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Shiprocket Disabled or Unconfigured</span>
            <p className="text-[11px] text-amber-800">
              Set <code className="bg-amber-100 px-1 rounded">SHIPROCKET_EMAIL</code>,{" "}
              <code className="bg-amber-100 px-1 rounded">SHIPROCKET_PASSWORD</code>, and{" "}
              <code className="bg-amber-100 px-1 rounded">SHIPROCKET_ENABLED=true</code> in{" "}
              <code className="bg-amber-100 px-1 rounded">.env.local</code>.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2">
          <AlertCircleIcon size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Logistics Notice:</span>
            <p className="text-[11px] text-red-800 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Shipment Details Strip */}
      {hasShipment ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                SR Order ID
              </span>
              <span className="font-bold text-neutral-900 font-mono text-xs">
                {shipment?.shiprocket_order_id || "N/A"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                Shipment ID
              </span>
              <span className="font-bold text-neutral-900 font-mono text-xs">
                {shipment?.shiprocket_shipment_id || "N/A"}
              </span>
            </div>
          </div>

          {/* Courier & AWB Code */}
          {hasAwb ? (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-emerald-950">
                  {shipment?.courier_name || "Assigned Courier"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                  {shipment?.status || "AWB ASSIGNED"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-500 font-bold uppercase">AWB:</span>
                  <span className="font-mono font-black text-sm text-neutral-950">
                    {shipment?.awb_code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(shipment?.awb_code || "", "AWB Code")}
                  className="p-1 hover:bg-emerald-100 rounded text-emerald-800 transition cursor-pointer"
                  title="Copy AWB Code"
                >
                  <CopyIcon size={14} />
                </button>
              </div>

              {isPickupScheduled && (
                <div className="text-[11px] text-emerald-900 flex items-center gap-1 pt-1 border-t border-emerald-200/60">
                  <ClockIcon size={12} className="text-emerald-700" />
                  <span>
                    Pickup Scheduled:{" "}
                    <strong>{shipment?.pickup_scheduled_date || "Today"}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 flex items-center justify-between">
              <span>Order registered on Shiprocket. AWB generation pending.</span>
            </div>
          )}

          {/* Live Tracking Status Strip */}
          {liveTracking && (
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Tracking: {liveTracking.currentStatus || "IN TRANSIT"}</span>
                </span>
                <button
                  type="button"
                  onClick={handleRefreshTracking}
                  disabled={refreshingTracking}
                  className="text-[10px] text-primary-dark font-bold hover:underline cursor-pointer"
                >
                  {refreshingTracking ? "Syncing..." : "Sync"}
                </button>
              </div>

              {liveTracking.scans && liveTracking.scans.length > 0 && (
                <div className="text-[11px] text-neutral-600 bg-white p-2 rounded-lg border border-neutral-200/60">
                  <div className="font-semibold text-neutral-900">
                    {liveTracking.scans[0].activity}
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    {liveTracking.scans[0].location} • {liveTracking.scans[0].date}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Freight Financial Accounting & Margin */}
          {freightAccounting && (
            <div className="p-3 rounded-xl bg-neutral-50/90 border border-neutral-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200/60">
                <span className="font-bold text-neutral-900 uppercase text-[10px] tracking-wider">
                  Freight Financial Accounting
                </span>
                {freightAccounting.netFreightMargin !== null && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      freightAccounting.netFreightMargin >= 0
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {freightAccounting.netFreightMargin >= 0
                      ? `+₹${freightAccounting.netFreightMargin.toFixed(2)} Margin`
                      : `-₹${Math.abs(freightAccounting.netFreightMargin).toFixed(2)} Subsidized`}
                  </span>
                )}
              </div>

              <div className="space-y-1 text-neutral-600 text-[11px]">
                <div className="flex justify-between">
                  <span>Customer Paid Shipping:</span>
                  <span className="font-semibold text-neutral-900">
                    {freightAccounting.customerShippingFee === 0
                      ? "₹0 (Free Shipping)"
                      : `₹${freightAccounting.customerShippingFee.toFixed(2)}`}
                  </span>
                </div>

                {freightAccounting.codFeeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>COD Handling Fee:</span>
                    <span className="font-semibold text-neutral-900">
                      +₹{freightAccounting.codFeeAmount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-1 border-t border-neutral-200/40 font-medium">
                  <span>Total Shipping Revenue:</span>
                  <span className="font-bold text-neutral-900">
                    ₹{freightAccounting.totalShippingCollected.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between pt-1 border-t border-neutral-200/40">
                  <span>Actual Courier Freight Cost:</span>
                  <span className="font-bold font-mono text-neutral-900">
                    {freightAccounting.actualFreightCost !== null
                      ? `₹${freightAccounting.actualFreightCost.toFixed(2)}`
                      : "Pending AWB assignment"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-center space-y-2">
          <PackageIcon size={24} className="mx-auto text-neutral-400" />
          <p className="text-xs text-neutral-600">
            This order has not been pushed to Shiprocket yet.
          </p>
        </div>
      )}

      {/* Action Buttons Grid */}
      <div className="space-y-2 pt-1 border-t border-neutral-100">
        {!hasShipment ? (
          <div>
            {!showConfigModal ? (
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                disabled={creatingOrder || orderStatus === "cancelled"}
                className="w-full h-10 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <PackageIcon size={14} />
                <span>Create Shiprocket Order</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3 animate-in fade-in">
                <span className="text-xs font-bold text-neutral-900 block">
                  Package Specifications
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block">
                      Weight (Kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-neutral-300 text-xs bg-white text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block">
                      Pickup Location
                    </label>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-neutral-300 text-xs bg-white text-neutral-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={creatingOrder}
                    className="flex-1 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {creatingOrder ? "Creating..." : "Confirm & Push Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="h-8 px-3 rounded-lg border border-neutral-300 text-xs text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* If shipment created but no AWB */}
            {!hasAwb && (
              <div className="space-y-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
                <div>
                  <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider block mb-1">
                    Courier Assignment Strategy
                  </label>
                  <select
                    value={selectedCourierId}
                    onChange={(e) => {
                      setSelectedCourierId(e.target.value);
                      setConfirmHigherCost(false);
                    }}
                    disabled={generatingAwb}
                    className="w-full h-8.5 px-2.5 rounded-lg border border-neutral-300 text-xs bg-white text-neutral-900 font-medium focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">
                      ✨ Recommended (Shiprocket AI / Smart Routing)
                    </option>
                    {availableCouriers.map((courier) => (
                      <option key={courier.courierCompanyId} value={courier.courierCompanyId}>
                        {courier.courierName} — ₹{courier.rate.toFixed(2)} ({courier.estimatedDeliveryDays} days)
                        {courier.rating ? ` ★ ${courier.rating}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    {selectedCourierId
                      ? `Selected custom carrier (₹${
                          availableCouriers.find((c) => String(c.courierCompanyId) === selectedCourierId)?.rate.toFixed(2)
                        } freight).`
                      : "Default: Uses Shiprocket Smart AI routing for highest delivery success rate."}
                  </p>
                  {(() => {
                    const chosen = availableCouriers.find(
                      (c) => String(c.courierCompanyId) === selectedCourierId
                    );
                    const customerFreight = freightAccounting?.customerShippingCharged ?? 0;
                    const isHigher = Boolean(chosen && customerFreight > 0 && chosen.rate > customerFreight);
                    if (!isHigher || !chosen) return null;
                    const diff = chosen.rate - customerFreight;
                    return (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5" data-testid="courier-cost-warning">
                        <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                          <span>⚠️</span> Higher Courier Cost Warning
                        </div>
                        <p className="text-[11px] leading-relaxed text-amber-700">
                          Selected courier costs <strong>₹{chosen.rate.toFixed(2)}</strong>, which is{" "}
                          <strong>₹{diff.toFixed(2)} higher</strong> than the customer quote of ₹{customerFreight.toFixed(2)}.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-medium text-amber-900">
                          <input
                            type="checkbox"
                            checked={confirmHigherCost}
                            onChange={(e) => setConfirmHigherCost(e.target.checked)}
                            className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                            data-testid="confirm-higher-cost-checkbox"
                          />
                          <span>I confirm booking this higher-cost courier</span>
                        </label>
                      </div>
                    );
                  })()}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAWB}
                  disabled={generatingAwb}
                  className="w-full h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  {generatingAwb ? "Assigning Courier..." : "Generate AWB & Assign Courier"}
                </button>
              </div>
            )}

            {/* If AWB assigned */}
            {hasAwb && (
              <div className="grid grid-cols-2 gap-2">
                {/* Print Label */}
                <button
                  type="button"
                  onClick={handlePrintLabel}
                  disabled={generatingLabel}
                  className="h-9 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {generatingLabel ? "Loading..." : "🖨️ Print Label"}
                </button>

                {/* Request Pickup */}
                <button
                  type="button"
                  onClick={handleRequestPickup}
                  disabled={requestingPickup || isPickupScheduled}
                  className={`h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                    isPickupScheduled
                      ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-default"
                      : "bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-300 cursor-pointer"
                  }`}
                >
                  {requestingPickup
                    ? "Scheduling..."
                    : isPickupScheduled
                    ? "✓ Pickup Scheduled"
                    : "📅 Request Pickup"}
                </button>

                {/* Print Manifest */}
                <button
                  type="button"
                  onClick={handlePrintManifest}
                  disabled={generatingManifest}
                  className="h-9 px-3 rounded-xl bg-white hover:bg-neutral-50 text-neutral-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-neutral-300 transition cursor-pointer"
                >
                  {generatingManifest ? "Loading..." : "📄 Manifest"}
                </button>

                {/* Refresh Live Tracking */}
                <button
                  type="button"
                  onClick={handleRefreshTracking}
                  disabled={refreshingTracking}
                  className="h-9 px-3 rounded-xl bg-white hover:bg-neutral-50 text-neutral-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-neutral-300 transition cursor-pointer"
                >
                  {refreshingTracking ? "Refreshing..." : "🔄 Track Live"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
