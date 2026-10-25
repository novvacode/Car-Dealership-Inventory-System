import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../types";
import { VehicleFilters } from "./VehicleFilters";

describe("VehicleFilters", () => {
  it("reports each field change", () => {
    const onChange = vi.fn();
    render(<VehicleFilters value={EMPTY_FILTERS} categories={["Sedan", "SUV"]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Make"), { target: { value: "Toy" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, make: "Toy" });

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "SUV" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, category: "SUV" });

    fireEvent.change(screen.getByLabelText("Max price"), { target: { value: "30000" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, maxPrice: "30000" });
  });

  it("resets all filters", async () => {
    const onChange = vi.fn();
    render(<VehicleFilters value={{ ...EMPTY_FILTERS, make: "Ford" }} categories={[]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });

  it("disables reset when no filter is active", () => {
    render(<VehicleFilters value={EMPTY_FILTERS} categories={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("flags an inverted price range", () => {
    render(<VehicleFilters value={{ ...EMPTY_FILTERS, minPrice: "50000", maxPrice: "1000" }} categories={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/min price must not exceed max price/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Min price")).toHaveAttribute("aria-invalid", "true");
  });
});
