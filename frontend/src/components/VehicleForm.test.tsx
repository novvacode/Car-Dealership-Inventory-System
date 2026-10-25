import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeVehicle } from "../test/utils";
import { validateVehicle, VehicleForm } from "./VehicleForm";

const valid = { make: "Ford", model: "F-150", category: "Truck", price: "41995", quantity: "3" };

describe("validateVehicle", () => {
  it("accepts valid input", () => {
    expect(validateVehicle(valid)).toEqual({});
  });

  it.each([
    [{ price: "0" }, "price", "greater than 0"],
    [{ price: "-10" }, "price", "greater than 0"],
    [{ price: "12.345" }, "price", "2 decimal places"],
    [{ price: "" }, "price", "Enter a price"],
    [{ quantity: "-1" }, "quantity", "cannot be negative"],
    [{ quantity: "1.5" }, "quantity", "whole number"],
    [{ make: "  " }, "make", "Required"],
  ])("rejects %o", (override, field, message) => {
    const errors = validateVehicle({ ...valid, ...override });
    expect(errors[field as keyof typeof errors]).toContain(message);
  });
});

describe("VehicleForm", () => {
  it("shows validation errors and does not submit invalid data", async () => {
    const onSubmit = vi.fn();
    render(<VehicleForm categories={[]} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText("Price (USD)"), "-5");
    await userEvent.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(screen.getByLabelText("Make")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Price must be greater than 0")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed values with numeric price and quantity", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<VehicleForm categories={["Truck"]} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText("Make"), " Ford ");
    await userEvent.type(screen.getByLabelText("Model"), "F-150");
    await userEvent.type(screen.getByLabelText("Category"), "Truck");
    await userEvent.type(screen.getByLabelText("Price (USD)"), "41995.50");
    await userEvent.clear(screen.getByLabelText("Quantity in stock"));
    await userEvent.type(screen.getByLabelText("Quantity in stock"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(onSubmit).toHaveBeenCalledWith({ make: "Ford", model: "F-150", category: "Truck", price: 41995.5, quantity: 4 });
  });

  it("pre-fills fields when editing", () => {
    render(<VehicleForm initial={makeVehicle()} categories={[]} onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(screen.getByLabelText("Make")).toHaveValue("Toyota");
    expect(screen.getByLabelText("Price (USD)")).toHaveValue(27500);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });
});
