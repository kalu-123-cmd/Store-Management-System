import React from 'react';
import { Logo } from './Logo';

/**
 * StoreOS Brand Component
 * 
 * Displays the StoreOS branding with Smart Retail Management tagline
 * Professional enterprise-grade branding for international markets
 */
export function StoreOSBrand() {
  return (
    <div className="flex items-center space-x-3">
      <Logo size="md" />
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-slate-900">
          Store<span className="text-blue-600">OS</span>
        </h1>
        <p className="text-xs uppercase tracking-widest text-slate-600">
          Smart Retail Management
        </p>
      </div>
    </div>
  );
}

// Maintain backward compatibility
export { StoreOSBrand as AIPoweredRetailBrand };