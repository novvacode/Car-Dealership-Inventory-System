import { useState, type FormEvent } from "react";
import type { Vehicle } from "../types";
import { formatPrice } from "../utils/format";
import { Modal } from "./Modal";
import { Button } from "./ui";

interface PurchaseDialogProps {
  vehicle: Vehicle;
  onConfirm: (quantity: number) => Promise<void>;
  onClose: () => void;
}

export function PurchaseDialog({ vehicle, onConfirm, onClose }: PurchaseDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const valid = Number.isInteger(quantity) && quantity >= 1 && quantity <= vehicle.quantity;

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
    <Modal title={`Purchase ${vehicle.make} ${vehicle.model}`} description={`${vehicle.quantity} available · ${formatPrice(vehicle.price)} each`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="purchase-qty" className="label">Quantity</label>
          <div className="flex items-center gap-2">
            <Button variant="secondary" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
              −
            </Button>
            <input
              id="purchase-qty"
              type="number"
              className="input text-center"
              min={1}
              max={vehicle.quantity}
              value={Number.isNaN(quantity) ? "" : quantity}
              onChange={(e) => setQuantity(e.target.valueAsNumber)}
              aria-invalid={!valid || undefined}
            />
            <Button variant="secondary" aria-label="Increase quantity" onClick={() => setQuantity((q) => Math.min(vehicle.quantity, (q || 0) + 1))} disabled={quantity >= vehicle.quantity}>
              +
            </Button>
          </div>
          {!valid && <p className="mt-2 text-xs font-medium text-red-600">Enter a whole number between 1 and {vehicle.quantity}.</p>}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
          <span className="text-sm text-stone-600">Total</span>
          <span className="text-xl font-extrabold text-ink-900">{valid ? formatPrice(quantity * vehicle.price) : "—"}</span>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={!valid}>Confirm purchase</Button>
        </div>
      </form>
    </Modal>
  );
}
