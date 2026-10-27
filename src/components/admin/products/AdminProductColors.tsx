"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  PlusIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  AlertCircleIcon,
  CheckIcon,
  UploadCloudIcon,
  StarIcon,
} from "../AdminIcons";
import type { ProductImageItem } from "./AdminProductImageUpload";
import { isUploadPath } from "@/lib/product-image";

export interface AdminProductColor {
  id?: string;
  name: string;
  hex: string;
  sku?: string;
  stock: number;
  priceOverride?: number | null;
  isActive: boolean;
  images: ProductImageItem[];
}

interface AdminProductColorsProps {
  hasColors: boolean;
  onToggleHasColors: (hasColors: boolean) => void;
  colors: AdminProductColor[];
  onChangeColors: (colors: AdminProductColor[]) => void;
  sharedImages: ProductImageItem[];
  onChangeSharedImages: (images: ProductImageItem[]) => void;
  enablePriceOverrides: boolean;
  onToggleEnablePriceOverrides: (enable: boolean) => void;
  basePrice: number;
  baseSku?: string;
}

const MAX_COLORS = 12;
const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

const PRESET_SWATCHES = [
  { name: "Pink", hex: "#FF69B4" },
  { name: "Sky Blue", hex: "#00BFFF" },
  { name: "Yellow", hex: "#FFD700" },
  { name: "Black", hex: "#1A1A1A" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Gold", hex: "#DAA520" },
  { name: "Mint Green", hex: "#98FF98" },
  { name: "Lavender", hex: "#E6E6FA" },
  { name: "Crimson Red", hex: "#DC143C" },
  { name: "Navy Blue", hex: "#000080" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Copper", hex: "#B87333" },
];

export function AdminProductColors({
  hasColors,
  onToggleHasColors,
  colors,
  onChangeColors,
  sharedImages,
  onChangeSharedImages,
  enablePriceOverrides,
  onToggleEnablePriceOverrides,
  basePrice,
  baseSku,
}: AdminProductColorsProps) {
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [deleteSharedImgIndex, setDeleteSharedImgIndex] = useState<number | null>(null);
  const [deleteColorImgIndex, setDeleteColorImgIndex] = useState<{ colorIdx: number; imgIdx: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const sharedFileInputRef = useRef<HTMLInputElement | null>(null);
  const colorFileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const handleAddColor = () => {
    if (colors.length >= MAX_COLORS) return;

    // Pick a preset color that hasn't been used yet if possible
    const existingNames = new Set(colors.map((c) => c.name.trim().toLowerCase()));
    const nextPreset = PRESET_SWATCHES.find((p) => !existingNames.has(p.name.toLowerCase())) || {
      name: `Color ${colors.length + 1}`,
      hex: "#6366F1",
    };

    const newColor: AdminProductColor = {
      id: crypto.randomUUID(),
      name: nextPreset.name,
      hex: nextPreset.hex,
      sku: baseSku ? `${baseSku}-${nextPreset.name.replace(/\s+/g, "").toUpperCase()}` : "",
      stock: 10,
      priceOverride: null,
      isActive: true,
      images: [],
    };

    onChangeColors([...colors, newColor]);
  };

  const handleUpdateColor = (index: number, updates: Partial<AdminProductColor>) => {
    const updated = [...colors];
    updated[index] = { ...updated[index], ...updates };
    onChangeColors(updated);
  };

  const handleRemoveColor = (index: number) => {
    const updated = colors.filter((_, idx) => idx !== index);
    onChangeColors(updated);
    setDeleteConfirmIndex(null);
  };

  const handleMoveColor = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= colors.length) return;
    const updated = [...colors];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChangeColors(updated);
  };

  // Color-specific image upload handler
  const handleColorImages = (colorIndex: number, fileList: FileList | File[]) => {
    setUploadError(null);
    const files = Array.from(fileList);
    const validImages: ProductImageItem[] = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError(`"${file.name}" has an unsupported format. Use JPG, PNG, or WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
        continue;
      }

      validImages.push({
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        url: URL.createObjectURL(file),
        name: file.name,
        isPrimary: colors[colorIndex].images.length === 0 && validImages.length === 0,
        file,
        size: file.size,
      });
    }

    if (validImages.length > 0) {
      const updatedColorImages = [...colors[colorIndex].images, ...validImages];
      handleUpdateColor(colorIndex, { images: updatedColorImages });
    }
  };

  // Shared image upload handler
  const handleSharedImages = (fileList: FileList | File[]) => {
    setUploadError(null);
    const files = Array.from(fileList);
    const validImages: ProductImageItem[] = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError(`"${file.name}" has an unsupported format. Use JPG, PNG, or WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
        continue;
      }

      validImages.push({
        id: `img-shared-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        url: URL.createObjectURL(file),
        name: file.name,
        isPrimary: sharedImages.length === 0 && validImages.length === 0,
        file,
        size: file.size,
      });
    }

    if (validImages.length > 0) {
      onChangeSharedImages([...sharedImages, ...validImages]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Master Toggle Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border border-neutral-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-neutral-900">
              This product has multiple colors
            </span>
            {hasColors && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-neutral-900 border border-primary/40">
                {colors.length} of {MAX_COLORS} Colors
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 max-w-xl">
            Enable independent stock, color-specific image galleries, and dedicated swatches per color.
            When turned off, the product behaves as an ordinary single-stock item.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          id="toggle-has-colors"
          aria-checked={hasColors}
          aria-label="Toggle multiple colors for this product"
          onClick={() => {
            if (!hasColors && colors.length === 0) {
              // Initialize with first default color if empty
              onChangeColors([
                {
                  name: "Default",
                  hex: "#6366F1",
                  sku: baseSku ? `${baseSku}-DEF` : "",
                  stock: 10,
                  priceOverride: null,
                  isActive: true,
                  images: [],
                },
              ]);
            }
            onToggleHasColors(!hasColors);
          }}
          className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
            hasColors ? "bg-primary" : "bg-neutral-300"
          }`}
        >
          <div
            className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
              hasColors ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {hasColors && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Price Override Toggle */}
          <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-neutral-800">
                Enable per-color price overrides
              </span>
              <p className="text-[11px] text-neutral-500">
                Disabled by default. When disabled, all colors use the product base price (₹{basePrice.toLocaleString("en-IN")}).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              id="toggle-price-overrides"
              aria-checked={enablePriceOverrides}
              aria-label="Toggle per-color price overrides"
              onClick={() => onToggleEnablePriceOverrides(!enablePriceOverrides)}
              className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                enablePriceOverrides ? "bg-primary" : "bg-neutral-300"
              }`}
            >
              <div
                className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                  enablePriceOverrides ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircleIcon size={16} className="shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Color List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Color Variants ({colors.length} / {MAX_COLORS})
              </h3>
              <button
                type="button"
                id="add-color-variant-btn"
                onClick={handleAddColor}
                disabled={colors.length >= MAX_COLORS}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer"
              >
                <PlusIcon size={14} />
                <span>Add Color</span>
              </button>
            </div>

            {colors.length === 0 ? (
              <div className="p-6 rounded-2xl bg-neutral-50 border border-dashed border-neutral-300 text-center text-xs text-neutral-500">
                No colors configured yet. Click &quot;Add Color&quot; above to add your first color option.
              </div>
            ) : (
              colors.map((c, idx) => (
                <div
                  key={c.id || `color-${idx}`}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    c.isActive
                      ? "bg-white border-neutral-200 shadow-xs"
                      : "bg-neutral-50/70 border-neutral-200 opacity-75"
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    {/* Top Row: Swatch, Name, Reorder, Remove */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Interactive Hex Color Swatch */}
                        <div className="relative group shrink-0">
                          <label
                            htmlFor={`color-picker-${idx}`}
                            className="w-9 h-9 rounded-full border-2 border-white shadow-sm flex items-center justify-center cursor-pointer transition hover:scale-105"
                            style={{ backgroundColor: c.hex }}
                            title={`Click to pick hex color (${c.hex})`}
                          >
                            <input
                              id={`color-picker-${idx}`}
                              type="color"
                              value={c.hex}
                              onChange={(e) => handleUpdateColor(idx, { hex: e.target.value })}
                              className="sr-only"
                            />
                          </label>
                        </div>

                        {/* Color Name Input */}
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => handleUpdateColor(idx, { name: e.target.value })}
                            placeholder="Color Name (e.g. Pink)"
                            aria-label={`Color name for variant ${idx + 1}`}
                            className="w-full max-w-xs px-3 py-1.5 rounded-lg border border-neutral-300 text-xs sm:text-sm font-bold text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* Controls: Reorder, Active Switch, Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveColor(idx, "up")}
                          disabled={idx === 0}
                          aria-label={`Move ${c.name} up`}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 transition cursor-pointer"
                        >
                          <ArrowUpIcon size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveColor(idx, "down")}
                          disabled={idx === colors.length - 1}
                          aria-label={`Move ${c.name} down`}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 transition cursor-pointer"
                        >
                          <ArrowDownIcon size={14} />
                        </button>

                        {/* Active toggle */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.isActive}
                          aria-label={`Toggle active state for ${c.name}`}
                          onClick={() => handleUpdateColor(idx, { isActive: !c.isActive })}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            c.isActive
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-neutral-100 text-neutral-500 border-neutral-200"
                          }`}
                        >
                          {c.isActive ? "Active" : "Hidden"}
                        </button>

                        {/* Remove button */}
                        <button
                          type="button"
                          aria-label={`Remove color ${c.name}`}
                          onClick={() => setDeleteConfirmIndex(idx)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2Icon size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Secondary Fields: Hex, SKU, Stock, Price Override */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-100">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          Hex Code
                        </label>
                        <input
                          type="text"
                          value={c.hex}
                          onChange={(e) => handleUpdateColor(idx, { hex: e.target.value })}
                          placeholder="#FF69B4"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs text-neutral-800 bg-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          SKU (Optional)
                        </label>
                        <input
                          type="text"
                          value={c.sku || ""}
                          onChange={(e) => handleUpdateColor(idx, { sku: e.target.value.toUpperCase() })}
                          placeholder="DEAR-PNK-01"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs text-neutral-800 uppercase bg-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          Stock Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={c.stock}
                          onChange={(e) =>
                            handleUpdateColor(idx, { stock: Math.max(0, parseInt(e.target.value, 10) || 0) })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 font-bold text-xs text-neutral-900 bg-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      {enablePriceOverrides && (
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Price Override (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={c.priceOverride !== null && c.priceOverride !== undefined ? c.priceOverride : ""}
                            onChange={(e) => {
                              const val = e.target.value.trim() === "" ? null : parseFloat(e.target.value);
                              handleUpdateColor(idx, { priceOverride: val });
                            }}
                            placeholder={basePrice ? String(basePrice) : "0"}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 font-bold text-xs text-neutral-900 bg-white focus:outline-none focus:border-primary"
                          />
                        </div>
                      )}
                    </div>

                    {/* Per-Color Gallery Strip */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-neutral-700">
                          {c.name} Gallery Photos ({c.images.length})
                        </span>
                        <input
                          type="file"
                          multiple
                          accept={ACCEPTED_TYPES.join(",")}
                          ref={(el) => {
                            colorFileInputRefs.current[idx] = el;
                          }}
                          onChange={(e) => {
                            if (e.target.files) handleColorImages(idx, e.target.files);
                            e.target.value = "";
                          }}
                          className="sr-only"
                          id={`color-img-input-${idx}`}
                        />
                        <button
                          type="button"
                          onClick={() => colorFileInputRefs.current[idx]?.click()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          <UploadCloudIcon size={12} />
                          <span>+ Add Photo for {c.name}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {c.images.map((img, imgIdx) => (
                          <div
                            key={img.id || `color-img-${idx}-${imgIdx}`}
                            className="relative w-16 h-16 rounded-xl border border-neutral-200 overflow-hidden bg-neutral-100 shrink-0 group"
                          >
                            <Image
                              src={img.url}
                              alt={img.name || `${c.name} image ${imgIdx + 1}`}
                              fill
                              unoptimized={isUploadPath(img.url)}
                              className="object-cover"
                              sizes="64px"
                            />
                            {imgIdx === 0 && (
                              <span className="absolute top-1 left-1 bg-neutral-900 text-white text-[9px] font-extrabold px-1 rounded">
                                Primary
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteColorImgIndex({ colorIdx: idx, imgIdx })}
                              aria-label={`Remove photo ${imgIdx + 1} from ${c.name}`}
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                            >
                              <Trash2Icon size={10} />
                            </button>
                          </div>
                        ))}

                        {c.images.length === 0 && (
                          <div
                            onClick={() => colorFileInputRefs.current[idx]?.click()}
                            className="w-16 h-16 rounded-xl border border-dashed border-neutral-300 hover:border-primary flex flex-col items-center justify-center text-neutral-400 hover:text-neutral-700 text-[10px] cursor-pointer transition shrink-0"
                          >
                            <PlusIcon size={14} />
                            <span>Upload</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Shared Images Section */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Shared Gallery Photos ({sharedImages.length})
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Shared images appear after the selected color&apos;s images in the storefront gallery for every color option.
                </p>
              </div>

              <input
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                ref={sharedFileInputRef}
                onChange={(e) => {
                  if (e.target.files) handleSharedImages(e.target.files);
                  e.target.value = "";
                }}
                className="sr-only"
                id="shared-images-input"
              />
              <button
                type="button"
                onClick={() => sharedFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition cursor-pointer"
              >
                <UploadCloudIcon size={14} />
                <span>+ Upload Shared Photos</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {sharedImages.map((img, sIdx) => (
                <div
                  key={img.id || `shared-img-${sIdx}`}
                  className="relative aspect-square rounded-xl border border-neutral-200 overflow-hidden bg-neutral-100 group"
                >
                  <Image
                    src={img.url}
                    alt={img.name || `Shared image ${sIdx + 1}`}
                    fill
                    unoptimized={isUploadPath(img.url)}
                    className="object-cover"
                    sizes="120px"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDeleteSharedImgIndex(sIdx)}
                      aria-label={`Remove shared photo ${sIdx + 1}`}
                      className="p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition"
                    >
                      <Trash2Icon size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {sharedImages.length === 0 && (
                <div
                  onClick={() => sharedFileInputRef.current?.click()}
                  className="col-span-full py-8 rounded-xl border border-dashed border-neutral-300 text-center text-xs text-neutral-400 hover:text-neutral-700 hover:border-primary transition cursor-pointer"
                >
                  <UploadCloudIcon size={20} className="mx-auto mb-1 opacity-60" />
                  <span>Click to add shared gallery photos for all color variants</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Color */}
      {deleteConfirmIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-neutral-200">
            <h4 className="font-bold text-sm text-neutral-900">
              Remove &quot;{colors[deleteConfirmIndex]?.name}&quot;?
            </h4>
            <p className="text-xs text-neutral-600">
              This will remove the color variant from the product. Historical customer orders will preserve their purchased color snapshots safely.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmIndex(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemoveColor(deleteConfirmIndex)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Shared Image */}
      {deleteSharedImgIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-neutral-200">
            <h4 className="font-bold text-sm text-neutral-900">
              Remove Shared Image?
            </h4>
            <p className="text-xs text-neutral-600">
              Are you sure you want to remove this photo from the shared gallery?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteSharedImgIndex(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeSharedImages(sharedImages.filter((_, idx) => idx !== deleteSharedImgIndex));
                  setDeleteSharedImgIndex(null);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              >
                Remove Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Color Image */}
      {deleteColorImgIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-neutral-200">
            <h4 className="font-bold text-sm text-neutral-900">
              Remove Color Photo?
            </h4>
            <p className="text-xs text-neutral-600">
              Are you sure you want to remove this photo from {colors[deleteColorImgIndex.colorIdx]?.name}&apos;s gallery?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteColorImgIndex(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { colorIdx, imgIdx } = deleteColorImgIndex;
                  const updatedImgs = colors[colorIdx].images.filter((_, i) => i !== imgIdx);
                  handleUpdateColor(colorIdx, { images: updatedImgs });
                  setDeleteColorImgIndex(null);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              >
                Remove Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
