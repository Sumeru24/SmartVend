import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "../components/ProtectedRoute";

const auth = vi.hoisted(() => ({ value: {} }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => auth.value,
}));

function renderRoute(roles = ["admin", "operator"]) {
  return render(
    <MemoryRouter initialEntries={["/admin/secret"]}>
      <Routes>
        <Route path="/admin/login" element={<div>Login destination</div>} />
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/admin/secret" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    auth.value = {
      loading: false,
      isAuthenticated: false,
      user: null,
    };
  });

  it("shows a loader while the session is restored", () => {
    auth.value = { loading: true, isAuthenticated: false, user: null };
    renderRoute();
    expect(screen.getByText(/Restoring secure session/)).toBeInTheDocument();
  });

  it("redirects anonymous visitors to the login page", () => {
    renderRoute();
    expect(screen.getByText("Login destination")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("allows users with an accepted role", () => {
    auth.value = {
      loading: false,
      isAuthenticated: true,
      user: { id: 1, role: "admin", full_name: "Aarav Mehta" },
    };
    renderRoute(["admin"]);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("rejects users whose role is not allowed", () => {
    auth.value = {
      loading: false,
      isAuthenticated: true,
      user: { id: 2, role: "operator", full_name: "Diya Nair" },
    };
    renderRoute(["admin"]);
    expect(screen.getByText("Access restricted")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
