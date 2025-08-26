import { useState, useEffect } from 'react';
import { ExecutiveOrder } from '../types/executiveOrder';

interface UseExecutiveOrdersOptions {
  state?: string;
  days?: number;
  limit?: number;
  autoFetch?: boolean;
}

interface UseExecutiveOrdersReturn {
  orders: ExecutiveOrder[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useExecutiveOrders(options: UseExecutiveOrdersOptions = {}): UseExecutiveOrdersReturn {
  const { state, days = 30, limit = 50, autoFetch = true } = options;

  const [orders, setOrders] = useState<ExecutiveOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (state) params.append('state', state);
      params.append('days', days.toString());
      params.append('limit', limit.toString());

      const response = await fetch(`/api/executive-orders?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setOrders(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch executive orders';
      setError(errorMessage);
      console.error('Error fetching executive orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchOrders();
    }
  }, [state, days, limit, autoFetch]);

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders
  };
}

export function useExecutiveOrderById(id: string) {
  const [order, setOrder] = useState<ExecutiveOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/executive-orders?id=${encodeURIComponent(id)}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Executive order not found');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        setOrder(result.data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch executive order';
        setError(errorMessage);
        console.error('Error fetching executive order:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  return { order, loading, error };
}
