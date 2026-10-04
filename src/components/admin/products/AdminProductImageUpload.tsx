"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  UploadCloudIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  StarIcon,
  AlertCircleIcon,
  PlusIcon,
  CheckIcon,
} from "../AdminIcons";

export interface ProductImageItem {
  id: string;
  url: string;
  name: string;
  isPrimary: boolean;
  size?: number;
  file?: File;
  isExisting?: boolean;
}

interface AdminProductImageUploadProps {
  images: ProductImageItem[];
  onChange: (images: ProductImageItem[]) => void;
  error?: string;
}

const MAX_IMAGES = 8;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE_MB = 5;

// Sample local catalog images that can be loaded with one click for demo convenience
const DEMO_PRESET_IMAGES = [
  { name: "Radha Krishna Figurine", path: "/product-samples/1.jpeg" },
  { name: "Golden Ganesha Idol", path: "/product-samples/2.jpeg" },
  { name: "Veena Ganesha Sculpture", path: "/product-samples/3.jpeg" },
  { name: "Bust Sculpture", path: "/product-samples/4.jpeg" },
  { name: "3D Shiva Idol", path: "/product-samples/5.jpeg" },
  { name: "Articulated Dragon", path: "/product-samples/6.jpeg" },
  { name: "Flexi Rex Skeleton", path: "/product-samples/7.jpeg" },
  { name: "Balancing Eagle Toy", path: "/product-samples/8.jpeg" },
];

/**
 * AdminProductImageUpload — Drag-and-drop image manager for Dearr admin product creation.
 *
 * Supports:
 * - Drag-and-drop file upload
 * - Click to browse file selection
 * - Multiple image uploads (up to 8 images)
 * - Format validation (JPG, JPEG, PNG, WEBP) and size limits
 * - Primary/cover image badge and selector
 * - Move forward / backward reordering affordances
 * - Remove image action
 * - Quick-load demo preset photos from local catalog
 * - Accessible controls and keyboard navigation
 */
export function AdminProductImageUpload({
  images,
  onChange,
  error,
}: AdminProductImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (fileList: FileList | File[]) => {
    setUploadError(null);
    const files = Array.from(fileList);

    if (images.length + files.length > MAX_IMAGES) {
      setUploadError(`Maximum of ${MAX_IMAGES} images allowed per product.`);
      return;
    }

    const validNewImages: ProductImageItem[] = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError(`"${file.name}" has an unsupported format. Use JPG, PNG, or WEBP.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
        continue;
      }

      const objectUrl = URL.createObjectURL(file);
      const isFirst = images.length === 0 && validNewImages.length === 0;

      validNewImages.push({
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        url: objectUrl,
        name: file.name,
        isPrimary: isFirst,
        size: file.size,
        file,
        isExisting: false,
      });
    }

    if (validNewImages.length > 0) {
      onChange([...images, ...validNewImages]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input value so same file can be selected again if needed
      e.target.value = "";
    }
  };

  const handleRemoveImage = (id: string) => {
    const target = images.find((img) => img.id === id);
    if (target && target.url.startsWith("blob:")) {
      URL.revokeObjectURL(target.url);
    }

    const updated = images.filter((img) => img.id !== id);
    // If the removed image was primary and others remain, set first as primary
    if (target?.isPrimary && updated.length > 0) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  const handleSetPrimary = (id: string) => {
    const updated = images.map((img) => ({
      ...img,
      isPrimary: img.id === id,
    }));
    onChange(updated);
  };

  const handleMoveImage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Primary status stays with the first item or preserves original flag
    onChange(reordered);
  };

  const handleAddDemoPreset = (preset: { name: string; path: string }) => {
    if (images.length >= MAX_IMAGES) {
      setUploadError(`Maximum of ${MAX_IMAGES} images allowed.`);
      return;
    }
    setUploadError(null);
    const isFirst = images.length === 0;
    const newImage: ProductImageItem = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      url: preset.path,
      name: preset.name,
      isPrimary: isFirst,
      isExisting: false,
    };
    onChange([...images, newImage]);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Counter */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
            Product Images
          </label>
          <p className="text-xs text-neutral-500 mt-0.5">
            Add high-resolution 3D print photos. The first image will be used as the catalog cover.
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
            images.length >= MAX_IMAGES
              ? "bg-amber-50 text-amber-900 border-amber-200"
              : "bg-neutral-100 text-neutral-600 border-neutral-200"
          }`}
        >
          {images.length} / {MAX_IMAGES} images
        </span>
      </div>

      {/* Drag & Drop Visual Area */}
      {images.length < MAX_IMAGES && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.005]"
              : "border-neutral-300 hover:border-neutral-400 bg-neutral-50/60 hover:bg-neutral-50"
          }`}
          aria-label="Upload product images"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleFileInputChange}
            className="hidden"
            aria-hidden="true"
            aria-label="Upload product images"
          />

          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200/90 shadow-xs flex items-center justify-center text-neutral-600">
              <UploadCloudIcon size={22} className="text-neutral-700" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-800">
                <span className="text-neutral-900 underline underline-offset-2">
                  Click to select photos
                </span>{" "}
                or drag and drop here
              </p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Supports JPG, PNG, WEBP up to 5MB each. High-detail 3D prints show best at 1:1 ratio.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation / Format Error Banner */}
      {(uploadError || error) && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in duration-150"
        >
          <AlertCircleIcon size={16} className="shrink-0 text-red-600" />
          <span>{uploadError || error}</span>
        </div>
      )}

      {/* Local Sample Photo Quick-Fill Affordance */}
      <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
            <span>Quick-Load Local Sample Photos:</span>
          </span>
          <span className="text-[10px] text-neutral-400">public/product-samples/</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_PRESET_IMAGES.map((preset) => {
            const alreadyAdded = images.some((img) => img.url === preset.path);
            return (
              <button
                key={preset.path}
                type="button"
                disabled={alreadyAdded || images.length >= MAX_IMAGES}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddDemoPreset(preset);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  alreadyAdded
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 opacity-60 cursor-default"
                    : "bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {alreadyAdded ? <CheckIcon size={12} /> : <PlusIcon size={12} />}
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-neutral-700">
            Uploaded Photos ({images.length})
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, index) => {
              const isFirst = index === 0;
              const isLast = index === images.length - 1;

              return (
                <div
                  key={img.id}
                  className={`group relative rounded-xl bg-surface border transition-all overflow-hidden flex flex-col ${
                    img.isPrimary
                      ? "border-primary ring-2 ring-primary/40 shadow-xs"
                      : "border-neutral-200/90 hover:border-neutral-300"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square w-full bg-neutral-100">
                    <Image
                      src={img.url}
                      alt={img.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover"
                    />

                    {/* Primary Badge */}
                    {img.isPrimary && (
                      <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white shadow-xs">
                        <StarIcon size={11} className="text-secondary" />
                        <span>Cover</span>
                      </div>
                    )}

                    {/* Existing vs New Origin Badge */}
                    {img.isExisting !== undefined && (
                      <div
                        className={`absolute ${
                          img.isPrimary ? "top-7" : "top-2"
                        } left-2 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-xs ${
                          img.isExisting
                            ? "bg-neutral-800/80 text-neutral-200 backdrop-blur-xs"
                            : "bg-emerald-700/90 text-white backdrop-blur-xs"
                        }`}
                      >
                        {img.isExisting ? "Existing" : "New"}
                      </div>
                    )}

                    {/* Delete action top-right */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      aria-label={`Remove photo ${img.name}`}
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-surface/90 hover:bg-red-50 text-neutral-600 hover:text-red-600 border border-neutral-200 flex items-center justify-center transition-all opacity-90 group-hover:opacity-100 shadow-xs"
                    >
                      <Trash2Icon size={14} />
                    </button>
                  </div>

                  {/* Actions / Info Bar */}
                  <div className="p-2 bg-surface flex flex-col gap-1 border-t border-neutral-100">
                    <div className="text-[11px] font-medium text-neutral-700 truncate" title={img.name}>
                      {img.name}
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-neutral-50">
                      {/* Set Primary Button */}
                      {!img.isPrimary ? (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(img.id)}
                          className="text-[10px] font-semibold text-neutral-600 hover:text-neutral-900 hover:underline cursor-pointer"
                        >
                          Make Cover
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-neutral-500">
                          Main Cover
                        </span>
                      )}

                      {/* Reordering Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveImage(index, "up")}
                          aria-label="Move image earlier"
                          className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move left"
                        >
                          <ArrowUpIcon size={12} className="-rotate-90" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveImage(index, "down")}
                          aria-label="Move image later"
                          className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move right"
                        >
                          <ArrowDownIcon size={12} className="-rotate-90" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
