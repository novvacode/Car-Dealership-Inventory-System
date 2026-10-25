import { useState, type FormEvent } from "react";
import type { Vehicle } from "../types";
import { Modal } from "./Modal";
import { MAX_STOCK } from "./VehicleForm";
import { Button } from "./ui";

interface RestockDialogProps {
  vehicle: Vehicle;
  onConfirm: (quantity: number) => Promise<void>;
  onClose: () => void;
}

export function RestockDialog({ vehicle, onConfirm, onClose }: RestockDialogProps) {
  const [value, setValue] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const quantity = Number(value);
  const maxAddable = MAX_STOCK - vehicle.quantity;
  const valid = value.trim() !== "" && Number.isInteger(quantity) && quantity >= 1 && quantity <= maxAddable;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      await onConfirm(quantity);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Restock ${vehicle.make} ${vehicle.model}`} description={`Currently ${vehicle.quantity} in stock`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="restock-qty" className="label">Units to add</label>
          <input id="restock-qty" className="input" type="number" min={1} step={1} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!valid || undefined} />
          {!valid ? (
            <p className="mt-2 text-xs font-medium text-red-600">Enter a whole number between 1 and {maxAddable.toLocaleString()}.</p>
          ) : (
            <p className="mt-2 text-xs text-stone-500">New stock level: {vehicle.quantity + quantity}</p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={!valid}>Restock</Button>
        </div>
      </form>
    </Modal>
  );
}
