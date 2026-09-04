import { useEffect, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_LOW_STOCK = gql`
  query GetStockAlerts {
    lowStockProducts {
      id name sku stock minStockLevel status
      category { name }
    }
  }
`;

export type StockAlert = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStockLevel: number;
  status: string;
  category: { name: string } | null;
  type: 'out' | 'low';
};

/**
 * Polls for low/out-of-stock products and fires a callback
 * when alerts are detected. Also fires on first load.
 */
export function useStockAlerts(onAlert: (alerts: StockAlert[]) => void) {
  const firedRef = useRef(false);
  // Hold a stable ref to the callback so we never need it as a useEffect dep
  const onAlertRef = useRef(onAlert);
  useEffect(() => { onAlertRef.current = onAlert; });

  const { data, refetch } = useQuery(GET_LOW_STOCK, {
    fetchPolicy: 'network-only',
    errorPolicy: 'ignore',
  });

  useEffect(() => {
    const products: any[] = data?.lowStockProducts || [];
    if (!products.length) return;

    const alerts: StockAlert[] = products.map(p => ({
      ...p,
      type: p.stock === 0 ? 'out' : 'low',
    }));

    // Only fire once per session on initial load
    if (!firedRef.current) {
      firedRef.current = true;
      onAlertRef.current(alerts);
    }
  }, [data]);

  // Re-poll every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      firedRef.current = false; // allow re-fire on next data load
      void refetch();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  const alerts: StockAlert[] = (data?.lowStockProducts || []).map((p: any) => ({
    ...p,
    type: p.stock === 0 ? 'out' : 'low',
  }));

  return { alerts, refetch };
}
