/**
 * Unified StoreOS Branding Component
 * 
 * This component provides a consistent, professional brand identity
 * for the StoreOS Enterprise platform with custom SVG graphics.
 * 
 * Key Features:
 * - Custom geometric 3D box/cube layer dynamics
 * - Gradient backgrounds (blue-600 → indigo-600 → violet-500)
 * - Clean typography with "StoreOS Enterprise" branding
 * - Multiple variants: Default, Compact, Light, Dark
 * - Responsive sizing for different UI contexts
 * - Accessibility compliant with proper alt text
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
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
 * Custom SVG Logo Component
 * 
 * Features a 3D isometric cube/box design with layer depth,
 * gradient fills, and dynamic geometric patterns representing
 * retail inventory and logistics.
 */
export function Logo({ 
  variant = 'default', 
  size = 'md', 
  className = '', 
  showText = true,
  ariaLabel = 'StoreOS Enterprise Logo'
}: LogoProps) {
  // Size configurations
  const sizes = {
    sm: { width: 24, height: 24, fontSize: 12 },
    md: { width: 32, height: 32, fontSize: 14 },
    lg: { width: 40, height: 40, fontSize: 16 },
    xl: { width: 48, height: 48, fontSize: 18 },
  };

  const { width, height, fontSize } = sizes[size];

  // Variant-specific configurations
  const isCompact = variant === 'compact' || variant === 'sidebar' || variant === 'icon-only';
  const isIconOnly = variant === 'icon-only';

  // Gradient definitions for SVG
  const gradients = (
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563eb" /> {/* blue-600 */}
        <stop offset="50%" stopColor="#4f46e5" /> {/* indigo-600 */}
        <stop offset="100%" stopColor="#8b5cf6" /> {/* violet-500 */}
      </linearGradient>
      <linearGradient id="logoGradientLight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="50%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
      <linearGradient id="faceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <linearGradient id="sideGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="topGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
  );

  // SVG paths for different variants
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
      
      {/* Background cube with gradient */}
      <path
        d="M12 8 L24 16 L52 16 L64 24 L64 48 L52 56 L24 56 L12 48 Z"
        fill="url(#logoGradient)"
        stroke="url(#logoGradient)"
        strokeWidth="1"
      />
      
      {/* Top face - lighter gradient */}
      <path
        d="M12 8 L12 32 L24 16 L52 16 L64 24 L64 24 L52 16 L24 16 L12 8"
        fill="url(#topGradient)"
        opacity="0.9"
      />
      
      {/* Left face - side gradient */}
      <path
        d="M12 8 L12 48 L24 56 L24 24 L12 8"
        fill="url(#sideGradient)"
        opacity="0.8"
      />
      
      {/* Right face - side gradient */}
      <path
        d="M52 16 L52 56 L64 48 L64 24 L52 16"
        fill="url(#sideGradient)"
        opacity="0.8"
      />
      
      {/* Inner geometric patterns - inventory boxes */}
      <rect x="24" y="24" width="16" height="16" rx="2" fill="white" opacity="0.2" />
      <rect x="28" y="28" width="8" height="8" rx="1" fill="white" opacity="0.3" />
      
      {/* Decorative elements representing layers/depth */}
      <path
        d="M12 48 L24 56 L52 56 L64 48"
        stroke="white"
        strokeWidth="0.5"
        opacity="0.3"
      />
      <path
        d="M12 8 L12 32 L24 16 L52 16 L64 24"
        stroke="white"
        strokeWidth="0.5"
        opacity="0.2"
      />
      
      {/* Accent lines for dimension indication */}
      <line x1="24" y1="56" x2="52" y2="56" stroke="white" strokeWidth="0.5" opacity="0.4" />
      <line x1="12" y1="32" x2="12" y2="48" stroke="white" strokeWidth="0.5" opacity="0.4" />
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
      
      {/* Simplified cube for compact variant */}
      <path
        d="M6 4 L12 8 L26 8 L32 12 L32 24 L26 28 L12 28 L6 24 Z"
        fill="url(#logoGradient)"
      />
      
      {/* Top face */}
      <path
        d="M6 4 L6 16 L12 8 L26 8 L32 12 L32 12 L26 8 L12 8 L6 4"
        fill="url(#topGradient)"
        opacity="0.9"
      />
      
      {/* Inner detail */}
      <rect x="12" y="12" width="8" height="8" rx="1" fill="white" opacity="0.2" />
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
      
      {/* Minimal cube for icon-only variant */}
      <path
        d="M4 3 L8 6 L20 6 L24 9 L24 18 L20 21 L8 21 L4 18 Z"
        fill="url(#logoGradient)"
      />
      
      {/* Top face */}
      <path
        d="M4 3 L4 12 L8 6 L20 6 L24 9 L24 9 L20 6 L8 6 L4 3"
        fill="url(#topGradient)"
        opacity="0.9"
      />
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
            className="font-bold text-foreground"
            style={{ fontSize: `${fontSize}px` }}
          >
            StoreOS
          </span>
          <span 
            className="text-[10px] font-medium text-muted-foreground tracking-wider"
            style={{ fontSize: `${Math.max(10, fontSize - 4)}px` }}
          >
            ENTERPRISE
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Favicon-ready SVG Component
 * 
 * Returns SVG suitable for favicon use with proper sizing
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
        <linearGradient id="faviconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="faviconTopGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="faviconSideGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      
      {/* Cube shape */}
      <path
        d="M6 4 L12 8 L26 8 L32 12 L32 24 L26 28 L12 28 L6 24 Z"
        fill="url(#faviconGradient)"
      />
      
      {/* Top face */}
      <path
        d="M6 4 L6 16 L12 8 L26 8 L32 12 L32 12 L26 8 L12 8 L6 4"
        fill="url(#faviconTopGradient)"
        opacity="0.9"
      />
      
      {/* Inner accent */}
      <rect x="12" y="12" width="8" height="8" rx="1" fill="white" opacity="0.2" />
    </svg>
  );
}

/**
 * Monochrome Logo for dark backgrounds
 * 
 * Uses white/light gradients for visibility on dark backgrounds
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
        <linearGradient id="monoGradientDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>
      
      <path
        d="M12 8 L24 16 L52 16 L64 24 L64 48 L52 56 L24 56 L12 48 Z"
        fill="url(#monoGradientDark)"
      />
      <path
        d="M12 8 L12 32 L24 16 L52 16 L64 24 L64 24 L52 16 L24 16 L12 8"
        fill="#ffffff"
        opacity="0.9"
      />
      <rect x="24" y="24" width="16" height="16" rx="2" fill="#60a5fa" opacity="0.3" />
    </svg>
  );
}

export default Logo;