import type { Vehicle } from "../types";
import { formatPrice } from "../utils/format";
import { Button, StockBadge } from "./ui";

interface VehicleCardProps {
  vehicle: Vehicle;
  onPurchase: (vehicle: Vehicle) => void;
}

export function VehicleCard({ vehicle, onPurchase }: VehicleCardProps) {
  const soldOut = vehicle.quantity === 0;

  return (
    <article
      aria-label={`${vehicle.make} ${vehicle.model}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative flex h-32 items-end justify-between bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-5 pb-4">
        <span className="absolute top-4 left-5 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-white/80 uppercase backdrop-blur">
          {vehicle.category}
        </span>
        <span aria-hidden className="pointer-events-none absolute -right-3 -bottom-6 text-[88px] leading-none font-extrabold text-white/[0.06] select-none">
          {vehicle.make.slice(0, 3).toUpperCase()}
        </span>
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent-500 uppercase">{vehicle.make}</p>
          <h3 className="text-xl font-extrabold text-white">{vehicle.model}</h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-stone-500">Price</p>
            <p className="text-2xl font-extrabold tracking-tight text-ink-900">{formatPrice(vehicle.price)}</p>
          </div>
          <StockBadge quantity={vehicle.quantity} />
        </div>

        <Button
          className="mt-auto w-full"
          disabled={soldOut}
          onClick={() => onPurchase(vehicle)}
          aria-label={soldOut ? `${vehicle.make} ${vehicle.model} is out of stock` : `Purchase ${vehicle.make} ${vehicle.model}`}
        >
          {soldOut ? "Out of stock" : "Purchase"}
        </Button>
      </div>
    </article>
  );
}
