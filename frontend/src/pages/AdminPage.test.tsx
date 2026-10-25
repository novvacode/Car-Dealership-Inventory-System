import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { admin, makeVehicle, mockApi, renderApp, signIn } from "../test/utils";

const camry = makeVehicle({ id: 1, quantity: 2 });

function row(name: string) {
  return screen.getByText(name).closest("tr")!;
}

describe("Admin dashboard", () => {
  it("adds a vehicle via the API", async () => {
    const created = makeVehicle({ id: 9, make: "Mazda", model: "CX-5", category: "SUV", price: 30000, quantity: 4 });
    const fetchMock = mockApi({
      ...signIn(admin),
      "GET /api/vehicles": () => ({ status: 200, body: [camry] }),
      "POST /api/vehicles": () => ({ status: 201, body: created }),
    });
    renderApp(<App />, { route: "/admin" });

    await userEvent.click(await screen.findByRole("button", { name: /add vehicle/i }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Make"), "Mazda");
    await userEvent.type(within(dialog).getByLabelText("Model"), "CX-5");
    await userEvent.type(within(dialog).getByLabelText("Category"), "SUV");
    await userEvent.type(within(dialog).getByLabelText("Price (USD)"), "30000");
    await userEvent.clear(within(dialog).getByLabelText("Quantity in stock"));
    await userEvent.type(within(dialog).getByLabelText("Quantity in stock"), "4");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add vehicle" }));

    expect(await screen.findByText("Mazda CX-5 added to inventory.")).toBeInTheDocument();
    expect(row("Mazda CX-5")).toHaveTextContent("4 in stock");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ make: "Mazda", model: "CX-5", category: "SUV", price: 30000, quantity: 4 });
  });

  it("keeps the form open and shows the error when the API rejects it", async () => {
    mockApi({
      ...signIn(admin),
      "GET /api/vehicles": () => ({ status: 200, body: [camry] }),
      "PUT /api/vehicles/1": () => ({ status: 422, body: { detail: [{ loc: ["body", "price"], msg: "Input should be greater than 0" }] } }),
    });
    renderApp(<App />, { route: "/admin" });

    await userEvent.click(await screen.findByRole("button", { name: "Edit Toyota Camry" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("price: Input should be greater than 0")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("restocks a vehicle", async () => {
    mockApi({
      ...signIn(admin),
      "GET /api/vehicles": () => ({ status: 200, body: [camry] }),
      "POST /api/vehicles/1/restock": (init) => {
        const { quantity } = JSON.parse(init.body as string);
        return { status: 200, body: { ...camry, quantity: camry.quantity + quantity } };
      },
    });
    renderApp(<App />, { route: "/admin" });

    await userEvent.click(await screen.findByRole("button", { name: "Restock Toyota Camry" }));
    const input = screen.getByLabelText("Units to add");
    await userEvent.clear(input);
    await userEvent.type(input, "10");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restock" }));

    expect(await screen.findByText(/12 Camry now in stock/)).toBeInTheDocument();
    expect(row("Toyota Camry")).toHaveTextContent("12 in stock");
  });

  it("deletes a vehicle after confirmation", async () => {
    const fetchMock = mockApi({
      ...signIn(admin),
      "GET /api/vehicles": () => ({ status: 200, body: [camry] }),
      "DELETE /api/vehicles/1": () => ({ status: 204 }),
    });
    renderApp(<App />, { route: "/admin" });

    await userEvent.click(await screen.findByRole("button", { name: "Delete Toyota Camry" }));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/vehicles/1"), expect.objectContaining({ method: "DELETE" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete vehicle" }));

    expect(await screen.findByText("Toyota Camry deleted.")).toBeInTheDocument();
    expect(screen.getByText("No vehicles yet")).toBeInTheDocument();
  });
});
