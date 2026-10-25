import type { PurchaseResponse, Vehicle, VehicleFilters, VehicleInput } from "../types";
import { apiRequest } from "./client";

function toQuery(filters: VehicleFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.make.trim()) query.make = filters.make.trim();
  if (filters.model.trim()) query.model = filters.model.trim();
  if (filters.category) query.category = filters.category;
  if (filters.minPrice !== "") query.min_price = filters.minPrice;
  if (filters.maxPrice !== "") query.max_price = filters.maxPrice;
  return query;
}

export const vehiclesApi = {
  list: () => apiRequest<Vehicle[]>("/api/vehicles", { query: { limit: "500" } }),

  /** Uses the search endpoint when any filter is set, otherwise the plain list. */
  search: (filters: VehicleFilters) => {
    const query = toQuery(filters);
    return Object.keys(query).length
      ? apiRequest<Vehicle[]>("/api/vehicles/search", { query: { ...query, limit: "500" } })
      : vehiclesApi.list();
  },

  create: (data: VehicleInput) => apiRequest<Vehicle>("/api/vehicles", { method: "POST", body: data }),

  update: (id: number, data: Partial<VehicleInput>) =>
    apiRequest<Vehicle>(`/api/vehicles/${id}`, { method: "PUT", body: data }),

  remove: (id: number) => apiRequest<void>(`/api/vehicles/${id}`, { method: "DELETE" }),

  purchase: (id: number, quantity: number) =>
    apiRequest<PurchaseResponse>(`/api/vehicles/${id}/purchase`, { method: "POST", body: { quantity } }),

  restock: (id: number, quantity: number) =>
    apiRequest<Vehicle>(`/api/vehicles/${id}/restock`, { method: "POST", body: { quantity } }),
};
