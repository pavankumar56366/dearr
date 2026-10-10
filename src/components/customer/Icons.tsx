import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export function SearchIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function CartIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

export function HeartIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export function UserIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function MenuIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function HomeIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function ShopIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2" />
    </svg>
  );
}

export function CloseIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function MinusIcon({ size = 16, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusIcon({ size = 16, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function TruckIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14v10" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

export function RotateCcwIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function PrinterIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}

export function SecureLockIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function MapPinIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function CreditCardIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

export function AlertCircleIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

export function PackageIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function ClockIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function LogOutIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

export function EditIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function TrashIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 16, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function MailIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function PhoneIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function CalendarIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

/* ==========================================================================
   Official Dearr SVGs (Extracted from docs/dearr_icons.zip)
   ========================================================================== */

export function SparkleIcon({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 6L26.5 17.5L38 22L26.5 26.5L22 38L17.5 26.5L6 22L17.5 17.5z" fill="#FDB10A" />
        <path d="M37 29L38.7 33.3L43 35L38.7 36.7L37 41L35.3 36.7L31 35L35.3 33.3z" fill="#FF5C93" strokeWidth="1.8" />
      </g>
    </svg>
  );
}

export function DearSearchIcon({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="21" cy="21" r="12" fill="#E6F7F9" />
        <path d="M30 30l11 11" strokeWidth="3.5" />
      </g>
    </svg>
  );
}

export function DearCartIcon({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.5 14H39.5L34.5 30h-19z" fill="#FDB10A" />
        <path d="M5 8h6l4.5 22h19" />
        <circle cx="19" cy="38" r="3" fill="#FF5A5F" />
        <circle cx="33" cy="38" r="3" fill="#FF5A5F" />
      </g>
    </svg>
  );
}

export function DearWishlistIcon({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 41C10 31 6 24 6 17a9 9 0 0 1 18-2.5A9 9 0 0 1 42 17c0 7-4 14-18 24z" fill="#FF3D6E" />
        <path d="M13 17a5 5 0 0 1 4-5" stroke="#fff" />
      </g>
    </svg>
  );
}

export function DearAccountIcon({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="15" r="8" fill="#FF5C93" />
        <path d="M8 42c0-9 7-14 16-14s16 5 16 14z" fill="#06B6C4" />
      </g>
    </svg>
  );
}

export function DearOrdersIcon({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="8" width="30" height="34" rx="5" fill="#E6F7F9" />
        <rect x="17" y="4" width="14" height="8" rx="3" fill="#06B6C4" />
        <path d="M16 22h16M16 29h16M16 36h9" />
      </g>
    </svg>
  );
}

export function DearMailIcon({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="11" width="36" height="26" rx="5" fill="#FFE0EC" />
        <path d="M7 14l17 12 17-12" />
        <path d="M24 35c-3-2-4.5-3.3-4.5-5a2.3 2.3 0 0 1 4.5-.9 2.3 2.3 0 0 1 4.5.9c0 1.7-1.5 3-4.5 5z" fill="#FF3D6E" stroke="none" />
      </g>
    </svg>
  );
}

/* Trust Badges */
export function PrecisionPrintIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="5" width="32" height="37" rx="5" fill="#E6F7F9" />
        <rect x="12" y="11" width="24" height="5.5" rx="2.75" fill="#06B6C4" />
        <path d="M21 16.5h6L24 23z" fill="#FF5A5F" />
        <rect x="17" y="32" width="14" height="7" rx="2" fill="#FDB10A" />
        <path d="M12 39h24" />
      </g>
    </svg>
  );
}

export function CustomPersonalizationIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 38l2-8L30.5 11.5a3.5 3.5 0 0 1 5 0l1 1a3.5 3.5 0 0 1 0 5L18 36z" fill="#FDB10A" />
        <path d="M10 38l2-8 6 6z" fill="#FFE0B2" />
        <path d="M27 15l6 6" />
        <path d="M39 27L40.5 31L44.5 32.5L40.5 34L39 38L37.5 34L33.5 32.5L37.5 31z" fill="#FF5C93" strokeWidth="1.8" />
        <path d="M33 6L33.84 8.16L36 9L33.84 9.84L33 12L32.16 9.84L30 9L32.16 8.16z" fill="#FF5A5F" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

export function EcoFriendlyPlaIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 37C9 21 20 9 40 9c1 20-9 29-26 28z" fill="#3DBE8B" />
        <path d="M12 37c5-9 12-16 20-21" />
        <path d="M12 37l-4 5" />
      </g>
    </svg>
  );
}

export function SafePackagingIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="17" width="32" height="25" rx="4" fill="#FDB10A" />
        <rect x="6" y="9" width="36" height="10" rx="3.5" fill="#FF5A5F" />
        <path d="M20 9h8v18h-8z" fill="#FFF1C9" />
      </g>
    </svg>
  );
}

export function AllIndiaDeliveryIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="11" width="26" height="22" rx="3.5" fill="#FF5A5F" />
        <path d="M30 18h8l6 7v8H30z" fill="#FDB10A" />
        <path d="M34 21.5h3.2l3 3.5H34z" fill="#E6F7F9" strokeWidth="2" />
        <circle cx="14" cy="35" r="4.5" fill="#fff" />
        <circle cx="36" cy="35" r="4.5" fill="#fff" />
        <path d="M17 29c-3-2-4.5-3.5-4.5-5.3a2.4 2.4 0 0 1 4.5-1 2.4 2.4 0 0 1 4.5 1c0 1.8-1.5 3.3-4.5 5.3z" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

/* Category SVGs */
export function SpiritualIdolsIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 36C14 37.5 8 34.5 5 29c6.5-1.5 12.5-.5 16 7z" fill="#FDB10A" />
        <path d="M27 36c7 1.5 13-1.5 16-7-6.5-1.5-12.5-.5-16 7z" fill="#FDB10A" />
        <path d="M23 33C14 33 8.5 27.5 8 19c8.5.5 14 5 15 14z" fill="#A66BC8" />
        <path d="M25 33c9 0 14.5-5.5 15-14-8.5.5-14 5-15 14z" fill="#A66BC8" />
        <path d="M24 8c5 5 6.5 14 0 26-6.5-12-5-21 0-26z" fill="#FF5C93" />
        <path d="M12 41h24" />
      </g>
    </svg>
  );
}

export function ArticulatedToysIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 11V8" />
        <circle cx="24" cy="5.5" r="2.5" fill="#FF5A5F" />
        <rect x="10" y="11" width="28" height="18" rx="7" fill="#06B6C4" />
        <rect x="15" y="31" width="18" height="11" rx="4" fill="#FDB10A" />
        <path d="M15 35l-6 4M33 35l6 4M20.5 25h7" />
        <circle cx="18" cy="19.5" r="1.8" fill="#2D3142" />
        <circle cx="30" cy="19.5" r="1.8" fill="#2D3142" />
      </g>
    </svg>
  );
}

export function CustomKeychainsIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="9" r="5.5" />
        <path d="M24 14.5V18" />
        <rect x="12" y="18" width="24" height="24" rx="7" fill="#FF5C93" />
        <path d="M24 37c-5-3.5-8-6.2-8-9.4a4.2 4.2 0 0 1 8-1.8 4.2 4.2 0 0 1 8 1.8c0 3.2-3 5.9-8 9.4z" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

export function DeskOrganizersIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="16" y="7" width="5" height="17" rx="2.5" fill="#FDB10A" />
        <rect x="23" y="4" width="5" height="20" rx="2.5" fill="#FF5A5F" />
        <rect x="30" y="9" width="5" height="15" rx="2.5" fill="#06B6C4" />
        <path d="M11 22h26l-3 19.5a2.5 2.5 0 0 1-2.5 2.2h-15a2.5 2.5 0 0 1-2.5-2.2z" fill="#A66BC8" />
        <path d="M17 30h14" stroke="#fff" />
      </g>
    </svg>
  );
}

export function LithophaneLampsIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="10" y="5" width="28" height="29" rx="6" fill="#FFE9A8" />
        <circle cx="19" cy="14" r="3" fill="#FDB10A" stroke="none" />
        <path d="M13 29l7-8 5 5 3-3 7 6" />
        <rect x="14" y="34" width="20" height="8" rx="3.5" fill="#A66BC8" />
      </g>
    </svg>
  );
}

export function MiniaturesDecorIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 9h10v5c6 3 8.5 8.5 8.5 14.5C37.5 35 33 40 24 40s-13.5-5-13.5-11.5C10.5 22.5 13 17 19 14z" fill="#FF5C93" />
        <path d="M17 28c0-3 1-5 3-7" stroke="#fff" />
        <path d="M38 3.5L39.5 7.5L43.5 9L39.5 10.5L38 14.5L36.5 10.5L32.5 9L36.5 7.5z" fill="#FDB10A" strokeWidth="1.8" />
      </g>
    </svg>
  );
}

export function StudyProjectsIcon({ size = 32, className = "", ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <g stroke="#2D3142" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 22v9c0 3.5 5 6 11 6s11-2.5 11-6v-9" fill="#A66BC8" />
        <path d="M24 8L5 17l19 9 19-9z" fill="#06B6C4" />
        <path d="M41 19v11" />
        <circle cx="41" cy="32.5" r="2.3" fill="#FDB10A" />
      </g>
    </svg>
  );
}
