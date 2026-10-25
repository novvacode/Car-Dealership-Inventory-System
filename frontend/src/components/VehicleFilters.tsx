import type { VehicleFilters as Filters } from "../types";
import { EMPTY_FILTERS } from "../types";
import { Button } from "./ui";

interface VehicleFiltersProps {
  value: Filters;
  categories: string[];
  onChange: (filters: Filters) => void;
}

export function VehicleFilters({ value, categories, onChange }: VehicleFiltersProps) {
  const set = (key: keyof Filters) => (event: { target: { value: string } }) =>
    onChange({ ...value, [key]: event.target.value });
  const active = Object.values(value).some((v) => v !== "");
  const invalidRange = value.minPrice !== "" && value.maxPrice !== "" && Number(value.minPrice) > Number(value.maxPrice);

  return (
    <form
      role="search"
      aria-label="Filter vehicles"
      onSubmit={(e) => e.preventDefault()}
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_auto]">
        <div>
          <label htmlFor="f-make" className="label">Make</label>
          <input id="f-make" className="input" placeholder="e.g. Toyota" value={value.make} onChange={set("make")} maxLength={50} />
        </div>
        <div>
          <label htmlFor="f-model" className="label">Model</label>
          <input id="f-model" className="input" placeholder="e.g. Camry" value={value.model} onChange={set("model")} maxLength={50} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="f-category" className="label">Category</label>
          <select id="f-category" className="input" value={value.category} onChange={set("category")}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-min" className="label">Min price</label>
          <input id="f-min" className="input" type="number" min={0} step={500} inputMode="numeric" placeholder="$0" value={value.minPrice} onChange={set("minPrice")} aria-invalid={invalidRange || undefined} />
        </div>
        <div>
          <label htmlFor="f-max" className="label">Max price</label>
          <input id="f-max" className="input" type="number" min={0} step={500} inputMode="numeric" placeholder="Any" value={value.maxPrice} onChange={set("maxPrice")} aria-invalid={invalidRange || undefined} />
        </div>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button variant="ghost" className="w-full" disabled={!active} onClick={() => onChange(EMPTY_FILTERS)}>
            Reset
          </Button>
        </div>
      </div>
      {invalidRange && <p className="mt-3 text-xs font-medium text-red-600">Min price must not exceed max price.</p>}
    </form>
  );
}
