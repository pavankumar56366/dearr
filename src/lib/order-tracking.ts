/**
 * Dearr Customer Order Tracking — 4 Stages Architecture
 *
 * Simplifies customer order tracking to exactly four canonical stages:
 * 1. Order Received
 * 2. Payment
 * 3. Packed & Dispatched
 * 4. Delivered
 *
 * Business Rules & State Invariants:
 * - Exactly four stages with canonical labels.
 * - Stage 1 (Order Received): completed when order exists in system.
 * - Stage 2 (Payment):
 *   - Prepaid Paid: completed only when payment is verified in backend ('paid' or 'simulated').
 *   - Prepaid Pending: current with 'Pending' badge. Never marked complete prematurely.
 *   - Prepaid Failed: failed with 'Failed' badge. Never marked complete.
 *   - Cash on Delivery (COD):
 *     - Before delivery: 'Due on Delivery' badge, non-blocking for dispatch.
 *     - After delivery: if backend confirms collection (isPaid), marked 'completed'.
 *       If backend has not confirmed collection, marked 'Collection Pending' and NOT completed.
 * - Stage 3 (Packed & Dispatched):
 *   - 'current' (Active) when status is 'processing'.
 *   - 'completed' when status is 'shipped' or 'delivered'.
 *   - 'upcoming' when status is 'pending' or 'confirmed'.
 * - Stage 4 (Delivered):
 *   - 'completed' ONLY when order status is genuinely 'delivered'.
 *   - 'current' (In Transit) when status is 'shipped'.
 *   - 'upcoming' otherwise. Never inferred from payment or dispatch.
 * - Cancelled orders: explicit cancellation state without false progression or delivery completion.
 * - Legacy or unexpected statuses: truthful fallback to upcoming without crashing or falsely claiming completion.
 */

export type TrackingStageId = "received" | "payment" | "packed_dispatched" | "delivered";

export type TrackingStageStatus = "completed" | "current" | "upcoming" | "failed";

export interface TrackingStage {
  id: TrackingStageId;
  label: "Order Received" | "Payment" | "Packed & Dispatched" | "Delivered";
  description: string;
  status: TrackingStageStatus;
  badge?: string;
  iconType: "check" | "card" | "truck" | "package" | "alert";
}

export interface OrderTrackingInput {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
}

export function isCodPaymentMethod(paymentMethod?: string): boolean {
  if (!paymentMethod) return false;
  return /cod|cash\s*on\s*delivery/i.test(paymentMethod);
}

export function isPaidPaymentStatus(paymentStatus?: string): boolean {
  if (!paymentStatus) return false;
  const s = paymentStatus.toLowerCase();
  return s === "paid" || s === "simulated";
}

export function isFailedPaymentStatus(paymentStatus?: string): boolean {
  if (!paymentStatus) return false;
  return paymentStatus.toLowerCase() === "failed";
}

/**
 * Computes exactly four order tracking stages from verified order state.
 */
export function getOrderTrackingStages(order: OrderTrackingInput): TrackingStage[] {
  const orderStatus = (order.status || "confirmed").toLowerCase();
  const paymentStatus = (order.paymentStatus || "pending").toLowerCase();
  const paymentMethod = order.paymentMethod || "";

  const isCancelled = orderStatus === "cancelled";
  const isCod = isCodPaymentMethod(paymentMethod);
  const isPaid = isPaidPaymentStatus(paymentStatus);
  const isPaymentFailed = isFailedPaymentStatus(paymentStatus);
  const isDelivered = orderStatus === "delivered";
  const isShipped = orderStatus === "shipped";
  const isProcessing = orderStatus === "processing";

  // Cancelled Order State Handling
  if (isCancelled) {
    const stage1: TrackingStage = {
      id: "received",
      label: "Order Received",
      description: "Order received (cancelled)",
      status: "completed",
      iconType: "check",
    };

    const stage2: TrackingStage = {
      id: "payment",
      label: "Payment",
      description: isPaid
        ? "Payment recorded (cancelled order)"
        : isPaymentFailed
        ? "Payment failed"
        : isCod
        ? "Cash on Delivery cancelled"
        : "Payment pending (cancelled order)",
      status: isPaid ? "completed" : isPaymentFailed ? "failed" : "upcoming",
      badge: isPaid ? "Refund Pending" : isPaymentFailed ? "Failed" : "Cancelled",
      iconType: "card",
    };

    const stage3: TrackingStage = {
      id: "packed_dispatched",
      label: "Packed & Dispatched",
      description: "Order cancelled before dispatch",
      status: "upcoming",
      iconType: "truck",
    };

    const stage4: TrackingStage = {
      id: "delivered",
      label: "Delivered",
      description: "Order cancelled — will not be delivered",
      status: "upcoming",
      iconType: "package",
    };

    return [stage1, stage2, stage3, stage4];
  }

  // Stage 1: Order Received
  const stage1: TrackingStage = {
    id: "received",
    label: "Order Received",
    description: "Your order has been received",
    status: "completed",
    iconType: "check",
  };

  // Stage 2: Payment
  let stage2: TrackingStage;
  if (isCod) {
    if (isPaid) {
      stage2 = {
        id: "payment",
        label: "Payment",
        description: "Cash on Delivery — payment collected",
        status: "completed",
        iconType: "card",
      };
    } else if (isDelivered) {
      // Delivered, but backend has not yet marked COD payment collected
      stage2 = {
        id: "payment",
        label: "Payment",
        description: "Cash on Delivery — awaiting collection reconciliation",
        status: "upcoming",
        badge: "Collection Pending",
        iconType: "card",
      };
    } else {
      // Normal pre-delivery COD
      stage2 = {
        id: "payment",
        label: "Payment",
        description: "Payment due on delivery (Cash on Delivery)",
        status: "upcoming",
        badge: "Due on Delivery",
        iconType: "card",
      };
    }
  } else {
    // Prepaid
    if (isPaid) {
      stage2 = {
        id: "payment",
        label: "Payment",
        description: "Payment confirmed",
        status: "completed",
        iconType: "card",
      };
    } else if (isPaymentFailed) {
      stage2 = {
        id: "payment",
        label: "Payment",
        description: "Payment failed — please retry payment",
        status: "failed",
        badge: "Failed",
        iconType: "alert",
      };
    } else {
      // Pending prepaid payment
      stage2 = {
        id: "payment",
        label: "Payment",
        description: "Payment confirmation pending",
        status: "current",
        badge: "Pending",
        iconType: "card",
      };
    }
  }

  // Stage 3: Packed & Dispatched
  let stage3: TrackingStage;
  if (isDelivered || isShipped) {
    stage3 = {
      id: "packed_dispatched",
      label: "Packed & Dispatched",
      description: "Your order has been packed and handed over for delivery",
      status: "completed",
      iconType: "truck",
    };
  } else if (isProcessing) {
    stage3 = {
      id: "packed_dispatched",
      label: "Packed & Dispatched",
      description: "Your order is being packed",
      status: "current",
      badge: "Active",
      iconType: "truck",
    };
  } else {
    // pending, confirmed, or unknown
    stage3 = {
      id: "packed_dispatched",
      label: "Packed & Dispatched",
      description: "Your order will be packed and handed over for delivery",
      status: "upcoming",
      iconType: "truck",
    };
  }

  // Stage 4: Delivered
  let stage4: TrackingStage;
  if (isDelivered) {
    stage4 = {
      id: "delivered",
      label: "Delivered",
      description: "Your order has arrived at the delivery address",
      status: "completed",
      iconType: "package",
    };
  } else if (isShipped) {
    stage4 = {
      id: "delivered",
      label: "Delivered",
      description: "In transit to delivery address",
      status: "current",
      badge: "In Transit",
      iconType: "package",
    };
  } else {
    // pending, confirmed, processing, or unknown
    stage4 = {
      id: "delivered",
      label: "Delivered",
      description: "Your order will arrive at the delivery address",
      status: "upcoming",
      iconType: "package",
    };
  }

  return [stage1, stage2, stage3, stage4];
}
