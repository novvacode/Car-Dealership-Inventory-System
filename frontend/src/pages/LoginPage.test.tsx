import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { customer, mockApi, renderApp } from "../test/utils";
import { validatePassword } from "./RegisterPage";

describe("Login", () => {
  it("signs in and lands on the inventory", async () => {
    const fetchMock = mockApi({
      "POST /api/auth/login": () => ({ status: 200, body: { access_token: "jwt-token", token_type: "bearer", user: customer } }),
      "GET /api/vehicles": () => ({ status: 200, body: [] }),
    });
    renderApp(<App />, { route: "/login" });

    await userEvent.type(screen.getByLabelText("Email"), "casey@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "S3curePass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Vehicle inventory" })).toBeInTheDocument();
    expect(localStorage.getItem("apex.token")).toBe("jwt-token");
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ email: "casey@example.com", password: "S3curePass" });
  });

  it("shows the server error for invalid credentials", async () => {
    mockApi({ "POST /api/auth/login": () => ({ status: 401, body: { detail: "Incorrect email or password" } }) });
    renderApp(<App />, { route: "/login" });

    await userEvent.type(screen.getByLabelText("Email"), "casey@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(localStorage.getItem("apex.token")).toBeNull();
  });
});

describe("Registration", () => {
  it("validates password rules before calling the API", async () => {
    const fetchMock = mockApi({});
    renderApp(<App />, { route: "/register" });

    await userEvent.type(screen.getByLabelText("Full name"), "Jane");
    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("letter and a number");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers, signs in automatically and welcomes the user", async () => {
    mockApi({
      "POST /api/auth/register": () => ({ status: 201, body: customer }),
      "POST /api/auth/login": () => ({ status: 200, body: { access_token: "t", token_type: "bearer", user: customer } }),
      "GET /api/vehicles": () => ({ status: 200, body: [] }),
    });
    renderApp(<App />, { route: "/register" });

    await userEvent.type(screen.getByLabelText("Full name"), "Casey Customer");
    await userEvent.type(screen.getByLabelText("Email"), "casey@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "S3curePass");
    await userEvent.type(screen.getByLabelText("Confirm password"), "S3curePass");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Vehicle inventory" })).toBeInTheDocument();
  });

  it("surfaces duplicate-email errors from the API", async () => {
    mockApi({ "POST /api/auth/register": () => ({ status: 409, body: { detail: "Email is already registered" } }) });
    renderApp(<App />, { route: "/register" });

    await userEvent.type(screen.getByLabelText("Full name"), "Casey");
    await userEvent.type(screen.getByLabelText("Email"), "casey@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "S3curePass");
    await userEvent.type(screen.getByLabelText("Confirm password"), "S3curePass");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email is already registered");
  });

  it("validatePassword mirrors the backend policy", () => {
    expect(validatePassword("short1")).toMatch(/at least 8/);
    expect(validatePassword("12345678")).toMatch(/letter and a number/);
    expect(validatePassword("S3curePass")).toBeNull();
  });
});
