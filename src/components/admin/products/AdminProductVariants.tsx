"use client";

import React from "react";
import { type SampleProductVariant } from "@/data/sample-products";
import { PlusIcon, Trash2Icon, LayersIcon } from "../AdminIcons";

interface AdminProductVariantsProps {
  variants: SampleProductVariant[];
  onChange: (variants: SampleProductVariant[]) => void;
  basePrice?: number;
  baseSku?: string;
}

/**
 * AdminProductVariants — Foundation UI for multi-variant product management.
 *
 * Supports adding, configuring, and removing optional variant specifications
 * (scale, colorway, filament finish) with per-variant pricing overrides, stock,
 * and SKUs.
 */
export function AdminProductVariants({
  variants,
  onChange,
  basePrice = 0,
  baseSku = "",
}: AdminProductVariantsProps) {
  const handleAddVariant = () => {
    const nextIndex = variants.length + 1;
    const newVariant: SampleProductVariant = {
      id: `var-${Date.now()}-${nextIndex}`,
      name: `Option ${nextIndex}`,
      sku: baseSku ? `${baseSku}-V${nextIndex}` : `SKU-V${nextIndex}`,
      price: basePrice > 0 ? basePrice : undefined,
      stockQuantity: 10,
      isActive: true,
    };
    onChange([...variants, newVariant]);
  };

  const handleUpdateVariant = (
    id: string,
    field: keyof SampleProductVariant,
    value: string | number | boolean | undefined
  ) => {
    onChange(
      variants.map((v) => {
        if (v.id !== id) return v;
        return {
          ...v,
          [field]: value,
        };
      })
    );
  };

  const handleRemoveVariant = (id: string) => {
    onChange(variants.filter((v) => v.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Product Variants
            </label>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">
              Optional
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Add variant options if this 3D print comes in multiple sizes, scales, or filament colors.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddVariant}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 hover:border-neutral-400 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-primary"
        >
          <PlusIcon size={14} />
          <span>Add Variant</span>
        </button>
      </div>

      {variants.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-neutral-200 p-6 text-center bg-neutral-50/50 space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
            <LayersIcon size={20} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-neutral-800">
              No variants added
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-0.5">
              Use variants for options such as size, color, or material. This product will be listed as a single standard 3D printed model.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddVariant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-all cursor-pointer"
          >
            <PlusIcon size={13} />
            <span>Create First Variant</span>
          </button>
        </div>
      ) : (
        /* Variants List / Table */
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 min-w-[140px]">Variant Title</th>
                  <th className="py-2.5 px-3 min-w-[110px]">SKU</th>
                  <th className="py-2.5 px-3 min-w-[100px]">Price (₹)</th>
                  <th className="py-2.5 px-3 min-w-[90px]">Stock</th>
                  <th className="py-2.5 px-3 w-20">Active</th>
                  <th className="py-2.5 px-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {variants.map((v) => (
                  <tr key={v.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => handleUpdateVariant(v.id, "name", e.target.value)}
                        placeholder="e.g. 15cm / Silk Gold"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) =>
                          handleUpdateVariant(v.id, "sku", e.target.value.toUpperCase())
                        }
                        placeholder="DEAR-V1"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 font-medium text-xs">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={v.price ?? ""}
                          onChange={(e) =>
                            handleUpdateVariant(
                              v.id,
                              "price",
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                          placeholder={basePrice ? String(basePrice) : "0"}
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </td>
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateVariant(v.id, "isActive", !v.isActive)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
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
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(v.id)}
                        aria-label={`Remove variant ${v.name}`}
                        className="w-8 h-8 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                        title="Delete variant"
                      >
                        <Trash2Icon size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
            <span>{variants.length} variant(s) configured</span>
            <span>Total variant inventory: {variants.reduce((acc, v) => acc + v.stockQuantity, 0)} units</span>
          </div>
        </div>
      )}
    </div>
  );
}
