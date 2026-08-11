/**
 * Premium StoreOS Branding Component
 * 
 * Professional retail management software platform logo
 * 
 * Brand Identity:
 * - Shopping cart subtly forming the letter "S"
 * - Three ascending analytics bars (inventory, sales, growth)
 * - Deep navy blue and professional royal blue primary colors
 * - Enterprise-grade SaaS aesthetic
 * - Clean geometric construction
 * 
 * @version 4.0.0 - Premium Professional Edition
 */

import React from 'react';

export interface LogoProps {
  variant?: 'default' | 'compact' | 'sidebar' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  ariaLabel?: string;
}

/**
 * Premium StoreOS Logo Component
 * 
 * Features:
 * - Shopping cart shape subtly forming letter "S"
 * - Three ascending analytics bars inside cart
 * - Deep navy blue (#0f172a) and royal blue (#2563eb) gradient
 * - Clean, minimalist geometric design
 * - Works at all sizes from favicon to billboard
 */
export function Logo({ 
  variant = 'default', 
  size = 'md', 
  className = '', 
  showText = true,
  ariaLabel = 'StoreOS Logo'
}: LogoProps) {
  // Size configurations
  const sizes = {
    sm: { width: 24, height: 24, fontSize: 10 },
    md: { width: 32, height: 32, fontSize: 12 },
    lg: { width: 40, height: 40, fontSize: 14 },
    xl: { width: 48, height: 48, fontSize: 16 },
  };

  const { width, height, fontSize } = sizes[size];

  // Variant-specific configurations
  const isCompact = variant === 'compact' || variant === 'sidebar' || variant === 'icon-only';
  const isIconOnly = variant === 'icon-only';

  // Premium gradient definitions
  const gradients = (
    <defs>
      <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0f172a" /> {/* Deep navy blue */}
        <stop offset="50%" stopColor="#1e40af" /> {/* Professional royal blue */}
        <stop offset="100%" stopColor="#2563eb" /> {/* Royal blue */}
      </linearGradient>
      <linearGradient id="cartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e40af" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
      <linearGradient id="bar1Gradient" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#10b981" /> {/* Emerald green */}
        <stop offset="100%" stopColor="#34d399" />
      </linearGradient>
      <linearGradient id="bar2Gradient" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#2563eb" /> {/* Royal blue */}
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <linearGradient id="bar3Gradient" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#f59e0b" /> {/* Warm amber */}
        <stop offset="100%" stopColor="#fbbf24" />
      </linearGradient>
    </defs>
  );

  // Main logo SVG - Shopping cart forming "S" with analytics bars
  const defaultLogo = (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel}
    >
      {gradients}
      
      {/* Shopping cart shape forming "S" */}
      <path
        d="M8 12 L16 16 L48 16 L56 20 L56 48 L48 52 L16 52 L8 48 Z"
        fill="url(#primaryGradient)"
        stroke="url(#primaryGradient)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      
      {/* Cart handle - forming top of "S" */}
      <path
        d="M20 12 L20 8 Q20 4 24 4 L40 4 Q44 4 44 8 L44 12"
        fill="none"
        stroke="url(#primaryGradient)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      
      {/* Three ascending analytics bars inside cart */}
      {/* Bar 1 - Inventory (Emerald green) */}
      <rect
        x="20"
        y="32"
        width="8"
        height="12"
        rx="1"
        fill="url(#bar1Gradient)"
      />
      
      {/* Bar 2 - Sales (Royal blue) */}
      <rect
        x="28"
        y="28"
        width="8"
        height="16"
        rx="1"
        fill="url(#bar2Gradient)"
      />
      
      {/* Bar 3 - Growth (Warm amber) */}
      <rect
        x="36"
        y="24"
        width="8"
        height="20"
        rx="1"
        fill="url(#bar3Gradient)"
      />
      
      {/* Cart wheels */}
      <circle cx="20" cy="56" r="4" fill="#0f172a" />
      <circle cx="44" cy="56" r="4" fill="#0f172a" />
      
      {/* Subtle "S" curve accent */}
      <path
        d="M16 28 Q32 28 32 40 Q32 52 48 52"
        fill="none"
        stroke="white"
        strokeWidth="1"
        opacity="0.2"
        strokeLinecap="round"
      />
    </svg>
  );

  const compactLogo = (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel}
    >
      {gradients}
      
      {/* Simplified cart shape */}
      <path
        d="M4 6 L8 8 L24 8 L28 10 L28 24 L24 26 L8 26 L4 24 Z"
        fill="url(#primaryGradient)"
      />
      
      {/* Cart handle */}
      <path
        d="M10 6 L10 4 Q10 2 12 2 L20 2 Q22 2 22 4 L22 6"
        fill="none"
        stroke="url(#primaryGradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Analytics bars */}
      <rect x="10" y="16" width="4" height="6" rx="0.5" fill="url(#bar1Gradient)" />
      <rect x="14" y="14" width="4" height="8" rx="0.5" fill="url(#bar2Gradient)" />
      <rect x="18" y="12" width="4" height="10" rx="0.5" fill="url(#bar3Gradient)" />
      
      {/* Wheels */}
      <circle cx="10" cy="28" r="2" fill="#0f172a" />
      <circle cx="22" cy="28" r="2" fill="#0f172a" />
    </svg>
  );

  const iconOnlyLogo = (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel}
    >
      {gradients}
      
      {/* Minimal cart */}
      <path
        d="M3 4 L6 6 L18 6 L21 8 L21 18 L18 20 L6 20 L3 18 Z"
        fill="url(#primaryGradient)"
      />
      
      {/* Handle */}
      <path
        d="M7 4 L7 3 Q7 1 9 1 L15 1 Q17 1 17 3 L17 4"
        fill="none"
        stroke="url(#primaryGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Bars */}
      <rect x="7" y="12" width="3" height="4" rx="0.5" fill="url(#bar1Gradient)" />
      <rect x="10" y="11" width="3" height="5" rx="0.5" fill="url(#bar2Gradient)" />
      <rect x="13" y="10" width="3" height="6" rx="0.5" fill="url(#bar3Gradient)" />
      
      {/* Wheels */}
      <circle cx="7" cy="21" r="1.5" fill="#0f172a" />
      <circle cx="17" cy="21" r="1.5" fill="#0f172a" />
    </svg>
  );

  // Select appropriate SVG based on variant
  const logoSvg = isIconOnly ? iconOnlyLogo : isCompact ? compactLogo : defaultLogo;

  // Determine if text should be shown
  const shouldShowText = showText && !isCompact && !isIconOnly;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {logoSvg}
      {shouldShowText && (
        <div className="flex flex-col">
          <span 
            className="font-bold text-foreground tracking-tight"
            style={{ fontSize: `${fontSize + 4}px` }}
          >
            Store<span className="text-blue-600">OS</span>
          </span>
          <span 
            className="text-[8px] font-semibold text-muted-foreground tracking-widest uppercase"
            style={{ fontSize: `${Math.max(8, fontSize - 2)}px` }}
          >
            Smart Retail Management
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Favicon-ready SVG Component
 */
export function FaviconLogo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="faviconPrimaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="faviconBar1Gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="faviconBar2Gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="faviconBar3Gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      
      <path
        d="M4 6 L8 8 L24 8 L28 10 L28 24 L24 26 L8 26 L4 24 Z"
        fill="url(#faviconPrimaryGradient)"
      />
      
      <path
        d="M10 6 L10 4 Q10 2 12 2 L20 2 Q22 2 22 4 L22 6"
        fill="none"
        stroke="url(#faviconPrimaryGradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      <rect x="10" y="16" width="4" height="6" rx="0.5" fill="url(#faviconBar1Gradient)" />
      <rect x="14" y="14" width="4" height="8" rx="0.5" fill="url(#faviconBar2Gradient)" />
      <rect x="18" y="12" width="4" height="10" rx="0.5" fill="url(#faviconBar3Gradient)" />
      
      <circle cx="10" cy="28" r="2" fill="#0f172a" />
      <circle cx="22" cy="28" r="2" fill="#0f172a" />
    </svg>
  );
}

/**
 * Monochrome Logo for dark backgrounds
 */
export function MonochromeLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg' | 'xl', className?: string }) {
  const sizes = {
    sm: { width: 24, height: 24 },
    md: { width: 32, height: 32 },
    lg: { width: 40, height: 40 },
    xl: { width: 48, height: 48 },
  };

  const { width, height } = sizes[size];

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="monoWhiteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>
      
      <path
        d="M8 12 L16 16 L48 16 L56 20 L56 48 L48 52 L16 52 L8 48 Z"
        fill="url(#monoWhiteGradient)"
      />
      <path
        d="M20 12 L20 8 Q20 4 24 4 L40 4 Q44 4 44 8 L44 12"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="20" y="32" width="8" height="12" rx="1" fill="#10b981" opacity="0.8" />
      <rect x="28" y="28" width="8" height="16" rx="1" fill="#3b82f6" opacity="0.8" />
      <rect x="36" y="24" width="8" height="20" rx="1" fill="#fbbf24" opacity="0.8" />
      <circle cx="20" cy="56" r="4" fill="#ffffff" />
      <circle cx="44" cy="56" r="4" fill="#ffffff" />
    </svg>
  );
}

export default Logo;