import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeVehicle } from "../test/utils";
import { PurchaseDialog } from "./PurchaseDialog";

describe("PurchaseDialog", () => {
  it("confirms the chosen quantity and shows the total", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<PurchaseDialog vehicle={makeVehicle({ price: 20000, quantity: 3 })} onConfirm={onConfirm} onClose={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByText("$40,000")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm purchase" }));

    expect(onConfirm).toHaveBeenCalledWith(2);
  });

  it("cannot exceed available stock", async () => {
    render(<PurchaseDialog vehicle={makeVehicle({ quantity: 1 })} onConfirm={vi.fn()} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  it("blocks invalid typed quantities", async () => {
    const onConfirm = vi.fn();
    render(<PurchaseDialog vehicle={makeVehicle({ quantity: 2 })} onConfirm={onConfirm} onClose={() => {}} />);

    const input = screen.getByLabelText("Quantity");
    await userEvent.clear(input);
    await userEvent.type(input, "5");

    expect(screen.getByText(/between 1 and 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm purchase" })).toBeDisabled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<PurchaseDialog vehicle={makeVehicle()} onConfirm={vi.fn()} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
