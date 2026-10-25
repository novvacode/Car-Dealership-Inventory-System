import { useMemo, useState } from "react";
import { vehiclesApi } from "../api/vehicles";
import { PurchaseDialog } from "../components/PurchaseDialog";
import { VehicleCard } from "../components/VehicleCard";
import { VehicleFilters } from "../components/VehicleFilters";
import { Button, EmptyState, ErrorAlert, LoadingBlock, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { mergeCategories, useDebouncedValue, useVehicles } from "../hooks/useVehicles";
import type { Vehicle } from "../types";
import { EMPTY_FILTERS } from "../types";

export function InventoryPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debounced = useDebouncedValue(filters, 300);
  const rangeInvalid =
    debounced.minPrice !== "" && debounced.maxPrice !== "" && Number(debounced.minPrice) > Number(debounced.maxPrice);
  // Don't send a request the API would reject; keep showing the last results.
  const { vehicles, replace, loading, error, reload } = useVehicles(debounced, { enabled: !rangeInvalid });
  const [buying, setBuying] = useState<Vehicle | null>(null);
  const categories = useMemo(() => mergeCategories(vehicles), [vehicles]);

  const filtered = Object.values(debounced).some((v) => v !== "");
  const unitsInStock = vehicles.reduce((sum, v) => sum + v.quantity, 0);
  const outOfStock = vehicles.filter((v) => v.quantity === 0).length;

  const purchase = async (quantity: number) => {
    if (!buying) return;
    try {
      const { vehicle } = await vehiclesApi.purchase(buying.id, quantity);
      replace(vehicle);
      toast.success(`Purchased ${quantity} × ${vehicle.make} ${vehicle.model}.`);
      setBuying(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
      setBuying(null);
      void reload(); // stock may have changed underneath us
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-accent-600 uppercase">Showroom</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">Vehicle inventory</h1>
          <p className="mt-2 text-sm text-stone-500">Hi {user?.full_name.split(" ")[0]} — find the right car and complete a purchase in seconds.</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            ["Models", vehicles.length],
            ["Units in stock", unitsInStock],
            ["Sold out", outOfStock],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-xs">
              <dt className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">{label}</dt>
              <dd className="text-2xl font-extrabold text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <VehicleFilters value={filters} categories={categories} onChange={setFilters} />

      <section aria-labelledby="results-heading" aria-busy={loading}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="results-heading" className="text-sm font-semibold text-stone-600">
            {loading ? "Loading vehicles…" : `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}${filtered ? (vehicles.length === 1 ? " matches" : " match") + " your filters" : ""}`}
          </h2>
          {loading && vehicles.length > 0 && <Spinner className="h-4 w-4 text-accent-500" />}
        </div>

        {error ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : loading && vehicles.length === 0 ? (
          <LoadingBlock label="Loading inventory…" />
        ) : vehicles.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No vehicles match"
              message="Try widening the price range or clearing some filters."
              action={<Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>}
            />
          ) : (
            <EmptyState title="The lot is empty" message="No vehicles have been added to the inventory yet." />
          )
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} onPurchase={setBuying} />
            ))}
          </div>
        )}
      </section>

      {buying && <PurchaseDialog vehicle={buying} onConfirm={purchase} onClose={() => setBuying(null)} />}
    </div>
  );
}
