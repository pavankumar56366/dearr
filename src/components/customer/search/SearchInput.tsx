"use client";

import React, { useRef, useEffect } from "react";
import { SearchIcon, CloseIcon } from "../Icons";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  onSubmit,
  placeholder = "Search 3D printed products, keychains, decor...",
  autoFocus = true,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        onSubmit(value.trim());
      }
    }
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="w-full relative"
    >
      <div className="w-full border-2 border-neutral-900 bg-surface rounded-none md:rounded-sm flex items-center justify-between px-4 py-3 md:py-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-neutral-900/10">
        <div className="flex items-center gap-3 flex-1 mr-2">
          <SearchIcon size={20} className="text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Search inquiry"
            className="w-full bg-transparent text-neutral-900 font-sans text-lg md:text-xl placeholder:text-neutral-400 outline-none selection:bg-primary/30"
          />
        </div>

        {/* Clear input button */}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Clear search input"
            className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
