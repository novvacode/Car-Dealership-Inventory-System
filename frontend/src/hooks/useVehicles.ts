import { useCallback, useEffect, useRef, useState } from "react";
import { vehiclesApi } from "../api/vehicles";
import type { Vehicle, VehicleFilters } from "../types";
import { EMPTY_FILTERS } from "../types";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Loads vehicles from the API for the given filters. Responses to superseded
 * requests are ignored so fast typing never shows stale results.
 */
export function useVehicles(filters: VehicleFilters = EMPTY_FILTERS, { enabled = true } = {}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const { make, model, category, minPrice, maxPrice } = filters;

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await vehiclesApi.search({ make, model, category, minPrice, maxPrice });
      if (requestId === latestRequest.current) setVehicles(result);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err instanceof Error ? err.message : "Failed to load vehicles");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [make, model, category, minPrice, maxPrice]);

  useEffect(() => {
    if (enabled) void load();
  }, [load, enabled]);

  /** Replace one vehicle in place after a mutation (purchase, edit, restock). */
  const replace = useCallback((updated: Vehicle) => {
    setVehicles((all) => all.map((v) => (v.id === updated.id ? updated : v)));
  }, []);

  return { vehicles, setVehicles, replace, loading, error, reload: load };
}

export const DEFAULT_CATEGORIES = ["Sedan", "SUV", "Truck", "Coupe", "Convertible", "Hatchback", "Electric", "Van"];

export function mergeCategories(vehicles: Vehicle[], known: string[] = DEFAULT_CATEGORIES): string[] {
  const seen = new Map(known.map((c) => [c.toLowerCase(), c]));
  for (const v of vehicles) if (!seen.has(v.category.toLowerCase())) seen.set(v.category.toLowerCase(), v.category);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
