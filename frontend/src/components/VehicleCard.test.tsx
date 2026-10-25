import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeVehicle } from "../test/utils";
import { VehicleCard } from "./VehicleCard";

describe("VehicleCard", () => {
  it("shows vehicle details, formatted price and stock", () => {
    render(<VehicleCard vehicle={makeVehicle({ price: 27500, quantity: 5 })} onPurchase={() => {}} />);

    const card = screen.getByRole("article", { name: "Toyota Camry" });
    expect(card).toHaveTextContent("Sedan");
    expect(card).toHaveTextContent("$27,500");
    expect(card).toHaveTextContent("5 in stock");
  });

  it("calls onPurchase with the vehicle when Purchase is clicked", async () => {
    const onPurchase = vi.fn();
    const vehicle = makeVehicle();
    render(<VehicleCard vehicle={vehicle} onPurchase={onPurchase} />);

    await userEvent.click(screen.getByRole("button", { name: "Purchase Toyota Camry" }));

    expect(onPurchase).toHaveBeenCalledWith(vehicle);
  });

  it("disables the purchase button when stock is zero", async () => {
    const onPurchase = vi.fn();
    render(<VehicleCard vehicle={makeVehicle({ quantity: 0 })} onPurchase={onPurchase} />);

    const button = screen.getByRole("button", { name: /out of stock/i });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it("warns when only a few units remain", () => {
    render(<VehicleCard vehicle={makeVehicle({ quantity: 1 })} onPurchase={() => {}} />);
    expect(screen.getByText("Only 1 left")).toBeInTheDocument();
  });
});
