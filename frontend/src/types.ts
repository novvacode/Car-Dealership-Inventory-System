export type Role = "customer" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface Vehicle {
  id: number;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export type VehicleInput = Pick<Vehicle, "make" | "model" | "category" | "price" | "quantity">;

export interface Purchase {
  id: number;
  vehicle_id: number | null;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface PurchaseResponse {
  purchase: Purchase;
  vehicle: Vehicle;
}

export interface VehicleFilters {
  make: string;
  model: string;
  category: string;
  minPrice: string;
  maxPrice: string;
}

export const EMPTY_FILTERS: VehicleFilters = { make: "", model: "", category: "", minPrice: "", maxPrice: "" };
