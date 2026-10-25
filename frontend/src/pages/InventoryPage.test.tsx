import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { admin, customer, makeVehicle, mockApi, renderApp, signIn } from "../test/utils";

const camry = makeVehicle({ id: 1, quantity: 2 });
const civic = makeVehicle({ id: 2, make: "Honda", model: "Civic", price: 24950, quantity: 0 });

describe("Inventory page", () => {
  it("redirects anonymous visitors to the login page", async () => {
    mockApi({});
    renderApp(<App />, { route: "/" });
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("lists vehicles from the API with disabled purchase for sold-out cars", async () => {
    mockApi({ ...signIn(customer), "GET /api/vehicles": () => ({ status: 200, body: [camry, civic] }) });
    renderApp(<App />);

    const civicCard = await screen.findByRole("article", { name: "Honda Civic" });
    expect(within(civicCard).getByRole("button", { name: /out of stock/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Purchase Toyota Camry" })).toBeEnabled();
    expect(screen.getByText("2 vehicles")).toBeInTheDocument();
  });

  it("shows an empty state when there is no inventory", async () => {
    mockApi({ ...signIn(customer), "GET /api/vehicles": () => ({ status: 200, body: [] }) });
    renderApp(<App />);
    expect(await screen.findByText("The lot is empty")).toBeInTheDocument();
  });

  it("shows an error with retry when loading fails", async () => {
    let calls = 0;
    mockApi({
      ...signIn(customer),
      "GET /api/vehicles": () => (++calls === 1 ? { status: 500, body: {} } : { status: 200, body: [camry] }),
    });
    renderApp(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/server encountered an error/i);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article", { name: "Toyota Camry" })).toBeInTheDocument();
  });

  it("searches via the API when filters are set", async () => {
    const fetchMock = mockApi({
      ...signIn(customer),
      "GET /api/vehicles": () => ({ status: 200, body: [camry, civic] }),
      "GET /api/vehicles/search": () => ({ status: 200, body: [civic] }),
    });
    renderApp(<App />);
    await screen.findByRole("article", { name: "Toyota Camry" });

    await userEvent.type(screen.getByLabelText("Make"), "hon");

    await waitFor(() => expect(screen.queryByRole("article", { name: "Toyota Camry" })).not.toBeInTheDocument());
    const searchCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/search"));
    expect(new URL(String(searchCall![0]), "http://x").searchParams.get("make")).toBe("hon");
    expect(screen.getByText("1 vehicle matches your filters")).toBeInTheDocument();
  });

  it("purchases a vehicle, updates stock and confirms with a toast", async () => {
    mockApi({
      ...signIn(customer),
      "GET /api/vehicles": () => ({ status: 200, body: [camry] }),
      "POST /api/vehicles/1/purchase": () => ({
        status: 200,
        body: { purchase: { id: 1, vehicle_id: 1, quantity: 1, unit_price: 27500, created_at: "" }, vehicle: { ...camry, quantity: 1 } },
      }),
    });
    renderApp(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Purchase Toyota Camry" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm purchase" }));

    expect(await screen.findByText("Purchased 1 × Toyota Camry.")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Toyota Camry" })).toHaveTextContent("Only 1 left");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the API error when stock ran out meanwhile, and reloads", async () => {
    let listCalls = 0;
    mockApi({
      ...signIn(customer),
      "GET /api/vehicles": () => ({ status: 200, body: [++listCalls === 1 ? camry : { ...camry, quantity: 0 }] }),
      "POST /api/vehicles/1/purchase": () => ({ status: 409, body: { detail: "Insufficient stock for this purchase" } }),
    });
    renderApp(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Purchase Toyota Camry" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm purchase" }));

    expect(await screen.findByText("Insufficient stock for this purchase")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /out of stock/i })).toBeDisabled());
  });
});

describe("Admin access", () => {
  it("hides the admin link and redirects customers away from /admin", async () => {
    mockApi({ ...signIn(customer), "GET /api/vehicles": () => ({ status: 200, body: [] }) });
    renderApp(<App />, { route: "/admin" });

    expect(await screen.findByRole("heading", { name: "Vehicle inventory" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("lets admins open the dashboard", async () => {
    mockApi({ ...signIn(admin), "GET /api/vehicles": () => ({ status: 200, body: [camry] }) });
    renderApp(<App />, { route: "/admin" });

    expect(await screen.findByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
  });

  it("signs out when the stored token is no longer valid", async () => {
    localStorage.setItem("apex.token", "expired");
    mockApi({ "GET /api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }) });
    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(localStorage.getItem("apex.token")).toBeNull();
  });
});
