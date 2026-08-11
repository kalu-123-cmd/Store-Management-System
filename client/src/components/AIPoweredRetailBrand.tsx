import React from 'react';
import { StoreOSLogo } from './Logo';

/**
 * AI Powered Retail Brand Component
 * 
 * Displays the StoreOS branding with AI-powered retail management tagline
 * Professional enterprise-grade branding for international markets
 */
export function AIPoweredRetailBrand() {
  return (
    <div className="flex items-center space-x-3">
      <StoreOSLogo size="md" />
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-slate-900">
          StoreOS
        </h1>
        <p className="text-xs uppercase tracking-widest text-slate-600">
          AI Powered Retail
        </p>
      </div>
    </div>
  );
}