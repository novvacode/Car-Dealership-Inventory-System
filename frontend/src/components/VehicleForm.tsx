import { useState, type FormEvent } from "react";
import type { Vehicle, VehicleInput } from "../types";
import { Button } from "./ui";

export const MAX_PRICE = 10_000_000;
export const MAX_STOCK = 100_000;

interface VehicleFormProps {
  initial?: Vehicle;
  categories: string[];
  onSubmit: (data: VehicleInput) => Promise<void>;
  onCancel: () => void;
}

type FormState = Record<keyof VehicleInput, string>;
type Errors = Partial<Record<keyof VehicleInput, string>>;

/** Mirrors the backend rules so users get immediate feedback; the API re-validates everything. */
export function validateVehicle(form: FormState): Errors {
  const errors: Errors = {};
  for (const key of ["make", "model"] as const) {
    if (!form[key].trim()) errors[key] = "Required";
    else if (form[key].trim().length > 50) errors[key] = "Max 50 characters";
  }
  if (!form.category.trim()) errors.category = "Required";
  else if (form.category.trim().length > 30) errors.category = "Max 30 characters";

  const price = Number(form.price);
  if (form.price.trim() === "" || Number.isNaN(price)) errors.price = "Enter a price";
  else if (price <= 0) errors.price = "Price must be greater than 0";
  else if (price > MAX_PRICE) errors.price = `Price cannot exceed $${MAX_PRICE.toLocaleString()}`;
  else if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim())) errors.price = "At most 2 decimal places";

  const quantity = Number(form.quantity);
  if (form.quantity.trim() === "" || !Number.isInteger(quantity)) errors.quantity = "Enter a whole number";
  else if (quantity < 0) errors.quantity = "Quantity cannot be negative";
  else if (quantity > MAX_STOCK) errors.quantity = `Quantity cannot exceed ${MAX_STOCK.toLocaleString()}`;
  return errors;
}

export function VehicleForm({ initial, categories, onSubmit, onCancel }: VehicleFormProps) {
  const [form, setForm] = useState<FormState>({
    make: initial?.make ?? "",
    model: initial?.model ?? "",
    category: initial?.category ?? "",
    price: initial ? String(initial.price) : "",
    quantity: initial ? String(initial.quantity) : "0",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const field = (key: keyof FormState) => ({
    id: `vf-${key}`,
    value: form[key],
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `vf-${key}-error` : undefined,
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const fieldError = (key: keyof FormState) =>
    errors[key] && (
      <p id={`vf-${key}-error`} className="mt-1 text-xs font-medium text-red-600">
        {errors[key]}
      </p>
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateVehicle(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await onSubmit({
        make: form.make.trim(),
        model: form.model.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        quantity: Number(form.quantity),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vf-make" className="label">Make</label>
          <input className="input" placeholder="Toyota" maxLength={50} {...field("make")} />
          {fieldError("make")}
        </div>
        <div>
          <label htmlFor="vf-model" className="label">Model</label>
          <input className="input" placeholder="Camry" maxLength={50} {...field("model")} />
          {fieldError("model")}
        </div>
      </div>
      <div>
        <label htmlFor="vf-category" className="label">Category</label>
        <input className="input" placeholder="Sedan" list="vf-category-options" maxLength={30} {...field("category")} />
        <datalist id="vf-category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {fieldError("category")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vf-price" className="label">Price (USD)</label>
          <input className="input" type="number" min={0.01} step="0.01" inputMode="decimal" placeholder="27500" {...field("price")} />
          {fieldError("price")}
        </div>
        <div>
          <label htmlFor="vf-quantity" className="label">Quantity in stock</label>
          <input className="input" type="number" min={0} step={1} inputMode="numeric" {...field("quantity")} />
          {fieldError("quantity")}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>{initial ? "Save changes" : "Add vehicle"}</Button>
      </div>
    </form>
  );
}
