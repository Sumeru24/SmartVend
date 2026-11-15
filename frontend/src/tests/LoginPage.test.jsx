import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../pages/admin/LoginPage";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    login: mocks.login,
    isAuthenticated: false,
    loading: false,
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<div>Control room</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.login.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
  });

  it("fills demo credentials and signs in", async () => {
    mocks.login.mockResolvedValue({
      id: 1,
      role: "admin",
      full_name: "Aarav Mehta",
    });
    renderLogin();

    await userEvent.click(screen.getByText("Administrator").closest("button"));
    expect(screen.getByLabelText("Work email")).toHaveValue("admin@smartvend.in");
    expect(screen.getByLabelText("Password")).toHaveValue("Admin@123");

    await userEvent.click(screen.getByRole("button", { name: /Enter control room/ }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith("admin@smartvend.in", "Admin@123"),
    );
    expect(await screen.findByText("Control room")).toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledWith("Welcome back, Aarav.");
  });

  it("shows API errors and keeps the user on the form", async () => {
    mocks.login.mockRejectedValue({
      response: { data: { detail: "Invalid email or password." } },
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText("Work email"), "wrong@smartvend.in");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: /Enter control room/ }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith("Invalid email or password.");
    expect(screen.queryByText("Control room")).not.toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    renderLogin();
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
