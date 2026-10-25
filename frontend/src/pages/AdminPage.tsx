import { useMemo, useState } from "react";
import { vehiclesApi } from "../api/vehicles";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { RestockDialog } from "../components/RestockDialog";
import { VehicleForm } from "../components/VehicleForm";
import { Button, EmptyState, ErrorAlert, LoadingBlock, StockBadge } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { mergeCategories, useVehicles } from "../hooks/useVehicles";
import type { Vehicle, VehicleInput } from "../types";
import { formatPrice } from "../utils/format";

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; vehicle: Vehicle }
  | { kind: "restock"; vehicle: Vehicle }
  | { kind: "delete"; vehicle: Vehicle }
  | null;

export function AdminPage() {
  const toast = useToast();
  const { vehicles, setVehicles, replace, loading, error, reload } = useVehicles();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [query, setQuery] = useState("");
  const categories = useMemo(() => mergeCategories(vehicles), [vehicles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => `${v.make} ${v.model} ${v.category}`.toLowerCase().includes(q));
  }, [vehicles, query]);

  const totalUnits = vehicles.reduce((sum, v) => sum + v.quantity, 0);
  const inventoryValue = vehicles.reduce((sum, v) => sum + v.quantity * v.price, 0);
  const lowStock = vehicles.filter((v) => v.quantity <= 2).length;

  const close = () => setDialog(null);

  /** Run a mutation, toast the outcome and close the dialog only on success. */
  const run = async (action: () => Promise<string>) => {
    try {
      toast.success(await action());
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const create = (data: VehicleInput) =>
    run(async () => {
      const created = await vehiclesApi.create(data);
      setVehicles((all) => [...all, created].sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model)));
      return `${created.make} ${created.model} added to inventory.`;
    });

  const edit = (vehicle: Vehicle) => (data: VehicleInput) =>
    run(async () => {
      replace(await vehiclesApi.update(vehicle.id, data));
      return `${data.make} ${data.model} updated.`;
    });

  const restock = (vehicle: Vehicle) => (quantity: number) =>
    run(async () => {
      const updated = await vehiclesApi.restock(vehicle.id, quantity);
      replace(updated);
      return `Added ${quantity} unit${quantity === 1 ? "" : "s"} — ${updated.quantity} ${vehicle.model} now in stock.`;
    });

  const remove = (vehicle: Vehicle) => () =>
    run(async () => {
      await vehiclesApi.remove(vehicle.id);
      setVehicles((all) => all.filter((v) => v.id !== vehicle.id));
      return `${vehicle.make} ${vehicle.model} deleted.`;
    });

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-accent-600 uppercase">Back office</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">Admin dashboard</h1>
          <p className="mt-2 text-sm text-stone-500">Add, edit, restock and remove vehicles.</p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })} className="self-start sm:self-auto">
          <span aria-hidden className="text-lg leading-none">+</span> Add vehicle
        </Button>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          ["Models listed", vehicles.length.toString()],
          ["Units in stock", totalUnits.toString()],
          ["Low / no stock", lowStock.toString()],
          ["Inventory value", formatPrice(inventoryValue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-xs">
            <dt className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">{label}</dt>
            <dd className="mt-1 truncate text-xl font-extrabold text-ink-900 sm:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-ink-900">Inventory</h2>
          <label className="sm:w-72">
            <span className="sr-only">Search inventory</span>
            <input className="input" placeholder="Search make, model or category" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorAlert message={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <LoadingBlock label="Loading inventory…" />
        ) : visible.length === 0 ? (
          <div className="p-4">
            {vehicles.length === 0 ? (
              <EmptyState
                title="No vehicles yet"
                message="Add your first vehicle to start building the inventory."
                action={<Button onClick={() => setDialog({ kind: "create" })}>Add vehicle</Button>}
              />
            ) : (
              <EmptyState title="No matches" message={`Nothing matches “${query}”.`} />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-stone-50 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Vehicle</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3 text-right">Price</th>
                  <th scope="col" className="px-4 py-3">Stock</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((v) => (
                  <tr key={v.id} className="transition hover:bg-stone-50/70">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink-900">{v.make} {v.model}</p>
                      <p className="text-xs text-stone-400">ID #{v.id}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{v.category}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPrice(v.price)}</td>
                    <td className="px-4 py-3"><StockBadge quantity={v.quantity} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-3 py-1.5" onClick={() => setDialog({ kind: "restock", vehicle: v })} aria-label={`Restock ${v.make} ${v.model}`}>Restock</Button>
                        <Button variant="ghost" className="px-3 py-1.5" onClick={() => setDialog({ kind: "edit", vehicle: v })} aria-label={`Edit ${v.make} ${v.model}`}>Edit</Button>
                        <Button variant="ghost" className="px-3 py-1.5 text-red-600 hover:bg-red-50" onClick={() => setDialog({ kind: "delete", vehicle: v })} aria-label={`Delete ${v.make} ${v.model}`}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog?.kind === "create" && (
        <Modal title="Add vehicle" description="New listings appear in the showroom immediately." onClose={close}>
          <VehicleForm categories={categories} onSubmit={create} onCancel={close} />
        </Modal>
      )}
      {dialog?.kind === "edit" && (
        <Modal title={`Edit ${dialog.vehicle.make} ${dialog.vehicle.model}`} onClose={close}>
          <VehicleForm initial={dialog.vehicle} categories={categories} onSubmit={edit(dialog.vehicle)} onCancel={close} />
        </Modal>
      )}
      {dialog?.kind === "restock" && <RestockDialog vehicle={dialog.vehicle} onConfirm={restock(dialog.vehicle)} onClose={close} />}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title="Delete vehicle?"
          message={`${dialog.vehicle.make} ${dialog.vehicle.model} will be permanently removed from the inventory. Past purchase records are kept.`}
          confirmLabel="Delete vehicle"
          onConfirm={remove(dialog.vehicle)}
          onClose={close}
        />
      )}
    </div>
  );
}
