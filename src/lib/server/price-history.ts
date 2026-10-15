import "server-only";
import crypto from "crypto";
import { query } from "./db";
import { recordInternalEvent } from "./events";
import { PoolConnection } from "mysql2/promise";

export interface RecordPriceChangeInput {
  productId: string;
  colorId?: string | null;
  previousPrice?: number;
  oldPrice?: number;
  newPrice: number;
  currentPrice?: number;
  changeSource?: string;
  reason?: string;
  changedBy?: string | null;
}

export interface ProductPriceHistoryRecord {
  id: string;
  productId: string;
  colorId: string | null;
  previousPrice: number;
  oldPrice: number;
  newPrice: number;
  currentPrice: number;
  changeSource: string;
  changedBy: string | null;
  changedAt: Date;
}

/**
 * Records a verified product or color-variant price change into `product_price_history`.
 *
 * Guarantees:
 * 1. Unchanged prices (previousPrice === newPrice within 0.009) do NOT generate duplicate events.
 * 2. Operates within an existing connection/transaction if provided, or manages its own query.
 * 3. Dispatches `product.price_changed` to `internal_events`.
 */
export async function recordProductPriceChange(
  input: RecordPriceChangeInput,
  conn?: PoolConnection
): Promise<ProductPriceHistoryRecord | null> {
  const prevRaw = input.previousPrice !== undefined ? input.previousPrice : input.oldPrice;
  if (prevRaw === undefined) {
    throw new Error("recordProductPriceChange requires previousPrice or oldPrice");
  }
  const prev = Math.round(Number(prevRaw) * 100) / 100;
  const next = Math.round(Number(input.newPrice) * 100) / 100;

  // Invariant: Unchanged prices do not create history rows
  if (Math.abs(prev - next) < 0.009) {
    return null;
  }

  const id = crypto.randomUUID();
  const currentPrice = input.currentPrice !== undefined ? Math.round(Number(input.currentPrice) * 100) / 100 : next;
  const changeSource = (input.changeSource || input.reason || "admin").trim().slice(0, 50);
  const changedBy = input.changedBy ? String(input.changedBy).trim() : null;
  const colorId = input.colorId ? String(input.colorId).trim() : null;

  const sql = `
    INSERT INTO product_price_history (
      id, product_id, color_id, previous_price, new_price, current_price,
      change_source, changed_by, changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  const params = [
    id,
    input.productId,
    colorId,
    prev,
    next,
    currentPrice,
    changeSource,
    changedBy,
  ];

  if (conn) {
    await conn.execute(sql, params);
  } else {
    await query(sql, params);
  }

  // Also log internal telemetry event safely
  await recordInternalEvent({
    eventType: "product.price_changed",
    userId: changedBy,
    metadata: {
      productId: input.productId,
      colorId,
      previousPrice: prev,
      newPrice: next,
      changeSource,
    },
  });

  return {
    id,
    productId: input.productId,
    colorId,
    previousPrice: prev,
    oldPrice: prev,
    newPrice: next,
    currentPrice,
    changeSource,
    changedBy,
    changedAt: new Date(),
  };
}

export const recordPriceChange = recordProductPriceChange;

/**
 * Retrieves the price change history for a given product or variant.
 */
export async function getProductPriceHistory(
  productId: string,
  limit = 50
): Promise<ProductPriceHistoryRecord[]> {
  const cleanId = String(productId || "").trim();
  if (!cleanId) return [];

  const rows = await query<any[]>(
    `SELECT id, product_id, color_id, previous_price, new_price, current_price,
            change_source, changed_by, changed_at
     FROM product_price_history
     WHERE product_id = ?
     ORDER BY changed_at DESC
     LIMIT ?`,
    [cleanId, Math.max(1, Math.min(100, limit))]
  );

  return (rows || []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    colorId: r.color_id || null,
    previousPrice: Number(r.previous_price),
    oldPrice: Number(r.previous_price),
    newPrice: Number(r.new_price),
    currentPrice: Number(r.current_price),
    changeSource: r.change_source,
    changedBy: r.changed_by || null,
    changedAt: new Date(r.changed_at),
  }));
}
