"use client";

import React, { useState, useMemo, useEffect } from "react";
import { type SampleProductVariant } from "@/data/sample-products";
import {
  PlusIcon,
  Trash2Icon,
  LayersIcon,
  SlidersIcon,
  CheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SparklesIcon,
  XIcon,
  TagIcon,
  RefreshCwIcon,
  ChevronDownIcon,
} from "../AdminIcons";
import type { AdminProductColor } from "./AdminProductColors";

export type VariantMode = "none" | "size" | "color_size" | "custom";

interface AdminProductVariantsProps {
  variants: SampleProductVariant[];
  onChange: (variants: SampleProductVariant[]) => void;
  colors?: AdminProductColor[];
  hasColors?: boolean;
  basePrice?: number;
  baseSku?: string;
  onToggleHasColors?: (hasColors: boolean) => void;
}

const PRESET_APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const PRESET_PRINT_SIZES = ["10cm", "15cm", "20cm", "25cm", "30cm"];
const PRESET_GENERAL_SIZES = ["Small", "Medium", "Large"];

/**
 * AdminProductVariants — Production-quality variant management interface for Dearr.
 *
 * Supports:
 * - Simple product without variants
 * - Size-only variants
 * - Color-size combination matrix (with independent price & stock)
 * - Custom multi-SKU variants
 * - Selective combination generation (e.g. Black in S & M, White in M only)
 * - Real-time duplicate combination & duplicate SKU detection
 * - Nullable fallback pricing (independent ₹0 vs base price fallback)
 * - Bulk update tools (apply price, stock, active state across variants)
 */
export function AdminProductVariants({
  variants,
  onChange,
  colors = [],
  hasColors = false,
  basePrice = 0,
  baseSku = "",
  onToggleHasColors,
}: AdminProductVariantsProps) {
  // Determine initial variant mode based on existing data
  const initialMode: VariantMode = useMemo(() => {
    if (!variants || variants.length === 0) {
      return hasColors ? "color_size" : "none";
    }
    const hasColorVariants = variants.some((v) => Boolean(v.colorId));
    const hasSizeVariants = variants.some((v) => Boolean(v.sizeName));
    if (hasColorVariants && hasSizeVariants) return "color_size";
    if (hasSizeVariants) return "size";
    return "custom";
  }, []); // Run once on mount

  const [mode, setMode] = useState<VariantMode>(initialMode);

  // Supported sizes list for generator
  const [configuredSizes, setConfiguredSizes] = useState<string[]>(() => {
    // Extract existing sizes from variants
    const existing = new Set<string>();
    variants.forEach((v) => {
      if (v.sizeName?.trim()) {
        existing.add(v.sizeName.trim());
      }
    });
    if (existing.size > 0) {
      return Array.from(existing);
    }
    return ["S", "M", "L"];
  });

  const [newSizeInput, setNewSizeInput] = useState("");

  // Combination selection matrix: map of "colorId::size" -> boolean (is checked)
  // Initially, all combinations existing in `variants` or all active colors × sizes are checked
  const [selectedCombos, setSelectedCombos] = useState<Record<string, boolean>>(() => {
    const initialMap: Record<string, boolean> = {};
    if (variants.length > 0) {
      variants.forEach((v) => {
        const cKey = v.colorId || "none";
        const sKey = v.sizeName || "default";
        initialMap[`${cKey}::${sKey}`] = true;
      });
    }
    return initialMap;
  });

  // Bulk edit state
  const [showBulkTools, setShowBulkTools] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  // Sync mode changes
  const handleModeChange = (newMode: VariantMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === "none") {
      // Clear variants for simple product
      onChange([]);
    } else if (newMode === "color_size" && !hasColors && onToggleHasColors) {
      // Auto-enable colors if switching to color-size mode
      onToggleHasColors(true);
    }
  };

  // Add a size to configured sizes
  const handleAddSize = (sizeName: string) => {
    const trimmed = sizeName.trim();
    if (!trimmed) return;
    if (!configuredSizes.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      const nextSizes = [...configuredSizes, trimmed];
      setConfiguredSizes(nextSizes);
      // Auto-check new size for existing colors
      const nextCombos = { ...selectedCombos };
      colors.forEach((c) => {
        const cId = c.id || c.name;
        nextCombos[`${cId}::${trimmed}`] = true;
      });
      setSelectedCombos(nextCombos);
    }
    setNewSizeInput("");
  };

  // Remove a size from configured sizes
  const handleRemoveSize = (sizeToRemove: string) => {
    setConfiguredSizes((prev) => prev.filter((s) => s !== sizeToRemove));
  };

  // Toggle a single combination in the matrix
  const handleToggleCombo = (colorKey: string, sizeName: string) => {
    const key = `${colorKey}::${sizeName}`;
    setSelectedCombos((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Select / Deselect all in matrix
  const handleSelectAllCombos = (selectAll: boolean) => {
    const updated: Record<string, boolean> = {};
    colors.forEach((c) => {
      const cId = c.id || c.name;
      configuredSizes.forEach((s) => {
        updated[`${cId}::${s}`] = selectAll;
      });
    });
    setSelectedCombos(updated);
  };

  // Generate combinations based on current selection
  const handleGenerateCombinations = () => {
    if (mode === "color_size") {
      if (colors.length === 0) return;
      if (configuredSizes.length === 0) return;

      const nextVariants: SampleProductVariant[] = [];
      const existingCombosMap = new Map<string, SampleProductVariant>();

      // Index existing variants by colorId::sizeName to preserve their IDs, prices, stock
      variants.forEach((v) => {
        const cKey = v.colorId || "";
        const sKey = (v.sizeName || "").toLowerCase();
        existingCombosMap.set(`${cKey}::${sKey}`, v);
      });

      colors.forEach((c) => {
        const cId = c.id || c.name;
        configuredSizes.forEach((size) => {
          const comboKey = `${cId}::${size}`;
          // Check if this combination was selected by the admin
          const isSelected = selectedCombos[comboKey] !== false;

          if (isSelected) {
            const existing = existingCombosMap.get(`${c.id || ""}::${size.toLowerCase()}`);
            if (existing) {
              // Preserve existing variant record
              nextVariants.push(existing);
            } else {
              // Generate new variant record
              const colorCode = c.name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
              const sizeCode = size.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
              const prefix = baseSku ? baseSku.trim() : "VAR";
              const sku = `${prefix}-${colorCode}-${sizeCode}`;

              nextVariants.push({
                id: crypto.randomUUID(),
                name: `${c.name} / ${size}`,
                sku,
                price: undefined, // Falls back to base price or color override
                stockQuantity: 10,
                isActive: true,
                colorId: c.id || null,
                sizeName: size,
              });
            }
          }
        });
      });

      onChange(nextVariants);
    } else if (mode === "size") {
      if (configuredSizes.length === 0) return;

      const nextVariants: SampleProductVariant[] = [];
      const existingSizesMap = new Map<string, SampleProductVariant>();

      variants.forEach((v) => {
        if (v.sizeName) {
          existingSizesMap.set(v.sizeName.toLowerCase(), v);
        }
      });

      configuredSizes.forEach((size) => {
        const existing = existingSizesMap.get(size.toLowerCase());
        if (existing) {
          nextVariants.push(existing);
        } else {
          const sizeCode = size.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          const prefix = baseSku ? baseSku.trim() : "VAR";
          const sku = `${prefix}-${sizeCode}`;

          nextVariants.push({
            id: crypto.randomUUID(),
            name: size,
            sku,
            price: undefined,
            stockQuantity: 10,
            isActive: true,
            colorId: null,
            sizeName: size,
          });
        }
      });

      onChange(nextVariants);
    }
  };

  // Add a single custom/empty variant
  const handleAddSingleVariant = () => {
    const nextIdx = variants.length + 1;
    const defaultColor = colors.length > 0 ? colors[0] : null;
    const defaultSize = configuredSizes.length > 0 ? configuredSizes[0] : null;

    let varName = `Option ${nextIdx}`;
    let varColorId: string | null = null;
    let varSizeName: string | null = null;

    if (mode === "color_size" && defaultColor && defaultSize) {
      varColorId = defaultColor.id || null;
      varSizeName = defaultSize;
      varName = `${defaultColor.name} / ${defaultSize}`;
    } else if (mode === "size" && defaultSize) {
      varSizeName = defaultSize;
      varName = defaultSize;
    }

    const newVariant: SampleProductVariant = {
      id: crypto.randomUUID(),
      name: varName,
      sku: baseSku ? `${baseSku}-V${nextIdx}` : `SKU-V${nextIdx}`,
      price: undefined,
      stockQuantity: 10,
      isActive: true,
      colorId: varColorId,
      sizeName: varSizeName,
    };

    onChange([...variants, newVariant]);
  };

  // Update a single variant
  const handleUpdateVariant = (
    id: string,
    field: keyof SampleProductVariant,
    value: string | number | boolean | null | undefined
  ) => {
    onChange(
      variants.map((v) => {
        if (v.id !== id) return v;

        const updated = { ...v, [field]: value };

        // Automatically synchronize display name when colorId or sizeName changes
        if (field === "colorId" || field === "sizeName") {
          const colorObj = colors.find((c) => c.id === updated.colorId);
          if (colorObj && updated.sizeName) {
            updated.name = `${colorObj.name} / ${updated.sizeName}`;
          } else if (colorObj) {
            updated.name = colorObj.name;
          } else if (updated.sizeName) {
            updated.name = updated.sizeName;
          }
        }

        return updated;
      })
    );
  };

  // Remove a variant
  const handleRemoveVariant = (id: string) => {
    onChange(variants.filter((v) => v.id !== id));
  };

  // Bulk Apply Price
  const handleApplyBulkPrice = () => {
    const parsed = parseFloat(bulkPrice);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(variants.map((v) => ({ ...v, price: parsed })));
      setBulkPrice("");
    } else if (bulkPrice.trim() === "") {
      // Clear to fallback
      onChange(variants.map((v) => ({ ...v, price: undefined })));
    }
  };

  // Bulk Apply Stock
  const handleApplyBulkStock = () => {
    const parsed = parseInt(bulkStock, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(variants.map((v) => ({ ...v, stockQuantity: parsed })));
      setBulkStock("");
    }
  };

  // Bulk Toggle Active
  const handleBulkToggleActive = (active: boolean) => {
    onChange(variants.map((v) => ({ ...v, isActive: active })));
  };

  // Real-time validation checks
  const validationState = useMemo(() => {
    const seenCombos = new Map<string, number>();
    const seenSkus = new Map<string, number>();
    const duplicateComboSet = new Set<string>();
    const duplicateSkuSet = new Set<string>();
    const invalidPriceSet = new Set<string>();
    const invalidStockSet = new Set<string>();
    const emptySkuSet = new Set<string>();

    variants.forEach((v) => {
      // Combo key
      if (v.colorId || v.sizeName) {
        const comboKey = `${v.colorId || "none"}::${(v.sizeName || "").toLowerCase().trim()}`;
        const count = seenCombos.get(comboKey) || 0;
        seenCombos.set(comboKey, count + 1);
        if (count > 0) duplicateComboSet.add(v.id);
      }

      // SKU key
      const cleanSku = (v.sku || "").trim().toUpperCase();
      if (!cleanSku) {
        emptySkuSet.add(v.id);
      } else {
        const count = seenSkus.get(cleanSku) || 0;
        seenSkus.set(cleanSku, count + 1);
        if (count > 0) duplicateSkuSet.add(v.id);
      }

      // Price
      if (v.price !== undefined && v.price !== null) {
        const num = Number(v.price);
        if (isNaN(num) || num < 0) invalidPriceSet.add(v.id);
      }

      // Stock
      if (typeof v.stockQuantity !== "number" || isNaN(v.stockQuantity) || v.stockQuantity < 0) {
        invalidStockSet.add(v.id);
      }
    });

    return {
      duplicateCombos: duplicateComboSet,
      duplicateSkus: duplicateSkuSet,
      invalidPrices: invalidPriceSet,
      invalidStocks: invalidStockSet,
      emptySkus: emptySkuSet,
      hasErrors:
        duplicateComboSet.size > 0 ||
        duplicateSkuSet.size > 0 ||
        invalidPriceSet.size > 0 ||
        invalidStockSet.size > 0 ||
        emptySkuSet.size > 0,
    };
  }, [variants]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalVariants = variants.length;
    const activeVariants = variants.filter((v) => v.isActive).length;
    const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);

    const prices = variants
      .map((v) => (v.price !== undefined && v.price !== null ? Number(v.price) : basePrice))
      .filter((p) => !isNaN(p));

    const minPrice = prices.length > 0 ? Math.min(...prices) : basePrice;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : basePrice;

    return {
      totalVariants,
      activeVariants,
      totalStock,
      minPrice,
      maxPrice,
    };
  }, [variants, basePrice]);

  return (
    <div className="space-y-6">
      {/* 1. Mode Selector Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
            <SlidersIcon size={14} className="text-primary" />
            <span>Variant Configuration Mode</span>
          </label>
          <span className="text-[11px] text-neutral-400">
            {mode === "none"
              ? "Simple Product"
              : mode === "color_size"
              ? "Color-Size Matrix"
              : mode === "size"
              ? "Size Variants"
              : "Custom Variants"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleModeChange("none")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === "none"
                ? "border-primary bg-primary/5 ring-1 ring-primary text-neutral-900"
                : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-600"
            }`}
          >
            <div className="text-xs font-bold">No Variants</div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Simple single SKU with base price &amp; stock
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("color_size")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === "color_size"
                ? "border-primary bg-primary/5 ring-1 ring-primary text-neutral-900"
                : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-600"
            }`}
          >
            <div className="text-xs font-bold flex items-center gap-1">
              <SparklesIcon size={13} className="text-primary" />
              <span>Color + Size Matrix</span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Each color &times; size combination has independent stock &amp; price
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("size")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === "size"
                ? "border-primary bg-primary/5 ring-1 ring-primary text-neutral-900"
                : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-600"
            }`}
          >
            <div className="text-xs font-bold">Size Only</div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Different sizes (S, M, L or 10cm, 15cm)
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("custom")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === "custom"
                ? "border-primary bg-primary/5 ring-1 ring-primary text-neutral-900"
                : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-600"
            }`}
          >
            <div className="text-xs font-bold">Custom Multi-SKU</div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Arbitrary options (e.g. Finish, Scale, Material)
            </div>
          </button>
        </div>
      </div>

      {/* 2. Generator Section (when mode is color_size or size) */}
      {(mode === "color_size" || mode === "size") && (
        <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200/70">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                A
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                Configure Supported Sizes
              </h3>
            </div>
            <span className="text-[11px] text-neutral-500">
              {configuredSizes.length} size(s) active
            </span>
          </div>

          {/* Quick presets & Custom size input */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-neutral-500 font-medium mr-1 text-[11px]">Quick Add:</span>
              <span className="text-neutral-400 text-[10px]">Apparel:</span>
              {PRESET_APPAREL_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleAddSize(sz)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                    configuredSizes.includes(sz)
                      ? "bg-primary/15 border-primary text-neutral-900"
                      : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  {sz}
                </button>
              ))}

              <span className="text-neutral-400 text-[10px] ml-2">3D Print:</span>
              {PRESET_PRINT_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleAddSize(sz)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                    configuredSizes.includes(sz)
                      ? "bg-primary/15 border-primary text-neutral-900"
                      : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            {/* Configured Size Tags & Input */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {configuredSizes.map((sz) => (
                <span
                  key={sz}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-800 shadow-2xs"
                >
                  <TagIcon size={12} className="text-primary" />
                  <span>{sz}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSize(sz)}
                    className="p-0.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-red-500 transition cursor-pointer"
                    aria-label={`Remove size ${sz}`}
                  >
                    <XIcon size={12} />
                  </button>
                </span>
              ))}

              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newSizeInput}
                  onChange={(e) => setNewSizeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSize(newSizeInput);
                    }
                  }}
                  placeholder="Add custom size (e.g. 500ml)"
                  className="px-3 py-1 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-44"
                />
                <button
                  type="button"
                  onClick={() => handleAddSize(newSizeInput)}
                  disabled={!newSizeInput.trim()}
                  className="px-2.5 py-1 rounded-xl bg-neutral-200 hover:bg-neutral-300 disabled:opacity-40 text-xs font-bold text-neutral-700 transition cursor-pointer"
                >
                  <PlusIcon size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Matrix Selection (in color_size mode) */}
          {mode === "color_size" && (
            <div className="pt-3 border-t border-neutral-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    B
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                    Select Combinations to Create
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectAllCombos(true)}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAllCombos(false)}
                    className="text-neutral-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {colors.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                  <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">No product colors configured yet.</span>
                    <p className="mt-0.5 text-amber-700">
                      Add colors in the &quot;Color Variants &amp; Galleries&quot; section above to generate color &times; size combinations.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {colors.map((c) => {
                    const cKey = c.id || c.name;
                    return (
                      <div
                        key={cKey}
                        className="p-3 rounded-xl bg-white border border-neutral-200 space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-neutral-300 shadow-2xs shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs font-bold text-neutral-900 truncate">
                            {c.name}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {configuredSizes.map((sz) => {
                            const isChecked = selectedCombos[`${cKey}::${sz}`] !== false;
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => handleToggleCombo(cKey, sz)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                                  isChecked
                                    ? "bg-primary/20 border-primary text-neutral-900 shadow-2xs font-bold"
                                    : "bg-neutral-50 border-neutral-200 text-neutral-400 line-through"
                                }`}
                              >
                                {isChecked && <CheckIcon size={11} className="text-primary" />}
                                <span>{sz}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <p className="text-[11px] text-neutral-500">
                  Tip: Excluded combinations will not be created, allowing asymmetric availability (e.g. Black in S &amp; M, White in M only).
                </p>
                <button
                  type="button"
                  onClick={handleGenerateCombinations}
                  disabled={colors.length === 0 || configuredSizes.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-neutral-900 text-xs font-black transition shadow-xs cursor-pointer"
                >
                  <SparklesIcon size={14} />
                  <span>Generate Selected Combinations</span>
                </button>
              </div>
            </div>
          )}

          {mode === "size" && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleGenerateCombinations}
                disabled={configuredSizes.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-neutral-900 text-xs font-black transition shadow-xs cursor-pointer"
              >
                <SparklesIcon size={14} />
                <span>Generate Size Variants</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Variants Table Header & Actions */}
      {mode !== "none" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Active Variant Combinations
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                  {variants.length} SKU{variants.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Every combination has an independent SKU, price override, inventory count, and active status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkTools(!showBulkTools)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-2xs ${
                  showBulkTools
                    ? "bg-neutral-800 border-neutral-800 text-white"
                    : "bg-white border-neutral-300 hover:border-neutral-400 text-neutral-700"
                }`}
              >
                <SlidersIcon size={13} />
                <span>Bulk Actions</span>
              </button>

              <button
                type="button"
                onClick={handleAddSingleVariant}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 hover:border-neutral-400 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition cursor-pointer shadow-2xs"
              >
                <PlusIcon size={14} />
                <span>Add Variant</span>
              </button>
            </div>
          </div>

          {/* Bulk Tools Strip */}
          {showBulkTools && variants.length > 0 && (
            <div className="p-3.5 rounded-xl bg-neutral-100/90 border border-neutral-200 text-xs flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Set Price for All:</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder={basePrice ? String(basePrice) : "0"}
                    className="w-24 pl-5 pr-2 py-1 rounded-lg border border-neutral-300 bg-white text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyBulkPrice}
                  className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:border-neutral-400 font-bold text-neutral-700 cursor-pointer shadow-2xs"
                >
                  Apply
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Set Stock for All:</span>
                <input
                  type="number"
                  min="0"
                  value={bulkStock}
                  onChange={(e) => setBulkStock(e.target.value)}
                  placeholder="10"
                  className="w-20 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleApplyBulkStock}
                  className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:border-neutral-400 font-bold text-neutral-700 cursor-pointer shadow-2xs"
                >
                  Apply
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => handleBulkToggleActive(true)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:border-neutral-400 font-semibold text-neutral-700 cursor-pointer"
                >
                  Activate All
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggleActive(false)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:border-neutral-400 font-semibold text-neutral-700 cursor-pointer"
                >
                  Deactivate All
                </button>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationState.hasErrors && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircleIcon size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Variant Configuration Issues Detected:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-red-700">
                  {validationState.duplicateCombos.size > 0 && (
                    <li>Duplicate color-size combinations exist. Each combination must be unique.</li>
                  )}
                  {validationState.duplicateSkus.size > 0 && (
                    <li>Duplicate variant SKUs detected. Every variant SKU must be globally unique.</li>
                  )}
                  {validationState.emptySkus.size > 0 && (
                    <li>One or more variants have an empty SKU.</li>
                  )}
                  {validationState.invalidPrices.size > 0 && (
                    <li>Variant price cannot be negative.</li>
                  )}
                  {validationState.invalidStocks.size > 0 && (
                    <li>Variant stock must be 0 or greater.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* 4. Variants Table */}
          {variants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center bg-white space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <LayersIcon size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-neutral-800">
                  No variants generated yet
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {mode === "color_size"
                    ? "Click 'Generate Selected Combinations' above or 'Add Variant' to build your combination matrix."
                    : "Add individual variant options or click Generate to get started."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSingleVariant}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition cursor-pointer"
              >
                <PlusIcon size={14} />
                <span>Create First Variant</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/90 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
                  <tr>
                    {mode === "color_size" && <th className="py-2.5 px-3 min-w-[120px]">Color</th>}
                    {(mode === "color_size" || mode === "size") && (
                      <th className="py-2.5 px-3 min-w-[90px]">Size</th>
                    )}
                    <th className="py-2.5 px-3 min-w-[130px]">Variant Title</th>
                    <th className="py-2.5 px-3 min-w-[120px]">SKU</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Price (₹)</th>
                    <th className="py-2.5 px-3 min-w-[90px]">Stock</th>
                    <th className="py-2.5 px-3 w-16 text-center">Active</th>
                    <th className="py-2.5 px-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {variants.map((v) => {
                    const hasComboError = validationState.duplicateCombos.has(v.id);
                    const hasSkuError = validationState.duplicateSkus.has(v.id) || validationState.emptySkus.has(v.id);
                    const hasPriceError = validationState.invalidPrices.has(v.id);
                    const hasStockError = validationState.invalidStocks.has(v.id);

                    const colorObj = colors.find((c) => c.id === v.colorId);

                    return (
                      <tr
                        key={v.id}
                        className={`hover:bg-neutral-50/80 transition-colors ${
                          hasComboError || hasSkuError ? "bg-red-50/40" : ""
                        }`}
                      >
                        {/* Color Selector */}
                        {mode === "color_size" && (
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              {colorObj && (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-neutral-300 shrink-0"
                                  style={{ backgroundColor: colorObj.hex }}
                                />
                              )}
                              <select
                                value={v.colorId || ""}
                                onChange={(e) =>
                                  handleUpdateVariant(v.id, "colorId", e.target.value || null)
                                }
                                className="w-full px-2 py-1 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-primary"
                              >
                                <option value="">None</option>
                                {colors.map((c) => (
                                  <option key={c.id || c.name} value={c.id || c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        )}

                        {/* Size Selector */}
                        {(mode === "color_size" || mode === "size") && (
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={v.sizeName || ""}
                              onChange={(e) => handleUpdateVariant(v.id, "sizeName", e.target.value)}
                              placeholder="e.g. M"
                              className="w-full px-2 py-1 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-primary"
                            />
                          </td>
                        )}

                        {/* Display Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={v.name}
                            onChange={(e) => handleUpdateVariant(v.id, "name", e.target.value)}
                            placeholder="Variant name"
                            className="w-full px-2 py-1 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-primary"
                          />
                          {hasComboError && (
                            <span className="text-[10px] text-red-600 block mt-0.5">
                              Duplicate combination
                            </span>
                          )}
                        </td>

                        {/* SKU */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) =>
                              handleUpdateVariant(v.id, "sku", e.target.value.toUpperCase())
                            }
                            placeholder="SKU"
                            className={`w-full px-2 py-1 rounded-lg border text-xs font-mono uppercase focus:outline-none ${
                              hasSkuError
                                ? "border-red-400 bg-red-50 text-red-900"
                                : "border-neutral-200 bg-white text-neutral-800 focus:border-primary"
                            }`}
                          />
                          {hasSkuError && (
                            <span className="text-[10px] text-red-600 block mt-0.5">
                              {validationState.emptySkus.has(v.id) ? "SKU required" : "Duplicate SKU"}
                            </span>
                          )}
                        </td>

                        {/* Price Override */}
                        <td className="py-2 px-3">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                              ₹
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={v.price !== undefined && v.price !== null ? v.price : ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateVariant(
                                  v.id,
                                  "price",
                                  val === "" ? undefined : Number(val)
                                );
                              }}
                              placeholder={basePrice ? `${basePrice} (Base)` : "Base"}
                              className={`w-full pl-5 pr-2 py-1 rounded-lg border text-xs focus:outline-none ${
                                hasPriceError
                                  ? "border-red-400 bg-red-50 text-red-900"
                                  : "border-neutral-200 bg-white text-neutral-800 focus:border-primary"
                              }`}
                            />
                          </div>
                          {v.price === undefined || v.price === null ? (
                            <span className="text-[9px] text-neutral-400 block mt-0.5">
                              Uses base price
                            </span>
                          ) : null}
                        </td>

                        {/* Stock Quantity */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            value={v.stockQuantity}
                            onChange={(e) =>
                              handleUpdateVariant(
                                v.id,
                                "stockQuantity",
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className={`w-full px-2 py-1 rounded-lg border text-xs focus:outline-none ${
                              hasStockError
                                ? "border-red-400 bg-red-50 text-red-900"
                                : "border-neutral-200 bg-white text-neutral-800 focus:border-primary"
                            }`}
                          />
                        </td>

                        {/* Active Toggle */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleUpdateVariant(v.id, "isActive", !v.isActive)}
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer mx-auto ${
                              v.isActive ? "bg-primary" : "bg-neutral-300"
                            }`}
                            aria-label={`Toggle active status for ${v.name}`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                v.isActive ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Delete Action */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(v.id)}
                            aria-label={`Remove variant ${v.name}`}
                            className="w-7 h-7 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                            title="Delete variant"
                          >
                            <Trash2Icon size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Summary Strip */}
              <div className="p-3 bg-neutral-50/70 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600 font-medium">
                <div className="flex items-center gap-4">
                  <span>
                    <strong className="text-neutral-900">{metrics.totalVariants}</strong> total SKU{metrics.totalVariants === 1 ? "" : "s"}
                  </span>
                  <span>
                    <strong className="text-neutral-900">{metrics.activeVariants}</strong> active
                  </span>
                  <span>
                    Total Inventory:{" "}
                    <strong className="text-neutral-900">{metrics.totalStock}</strong> units
                  </span>
                </div>

                <div>
                  Price Range:{" "}
                  <strong className="text-neutral-900">
                    {metrics.minPrice === metrics.maxPrice
                      ? `₹${metrics.minPrice.toLocaleString("en-IN")}`
                      : `₹${metrics.minPrice.toLocaleString("en-IN")} – ₹${metrics.maxPrice.toLocaleString("en-IN")}`}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "none" && (
        <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 text-xs text-neutral-600 flex items-center justify-between">
          <div>
            <span className="font-bold text-neutral-800">Simple Product Configuration Active</span>
            <p className="mt-0.5 text-neutral-500">
              This product will use the base price and general inventory without multi-SKU variations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleModeChange("color_size")}
            className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 hover:border-neutral-400 font-bold text-neutral-800 transition cursor-pointer text-xs"
          >
            Enable Variants
          </button>
        </div>
      )}
    </div>
  );
}
