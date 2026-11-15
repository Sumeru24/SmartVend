import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Logo } from "../components/Logo";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { MachineStatusBadge, StatusBadge } from "../components/ui/StatusBadge";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { ThemeProvider } from "../context/ThemeContext";
import { titleCase } from "../utils/format";

describe("Logo", () => {
  it("renders the brand", () => {
    render(<Logo />);
    expect(screen.getByText("SmartVend")).toBeInTheDocument();
    expect(screen.getByText("Automata OS")).toBeInTheDocument();
  });

  it("can render compact", () => {
    render(<Logo compact />);
    expect(screen.queryByText("SmartVend")).not.toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("renders known FSM states with a readable label", () => {
    render(<StatusBadge state="PAYMENT_ACCEPTED" />);
    expect(screen.getByText("Payment accepted")).toBeInTheDocument();
  });

  it("falls back to title case for unknown states", () => {
    render(<StatusBadge state="MANUAL_OVERRIDE" dot={false} />);
    expect(screen.getByText(titleCase("MANUAL_OVERRIDE"))).toBeInTheDocument();
  });

  it("renders machine statuses", () => {
    const { rerender } = render(<MachineStatusBadge status="online" />);
    expect(screen.getByText("Online")).toBeInTheDocument();
    rerender(<MachineStatusBadge status="maintenance" />);
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("shows a title, description and optional action", () => {
    render(
      <EmptyState title="No products" description="Add your first product." action={<button>Add</button>} />,
    );
    expect(screen.getByText("No products")).toBeInTheDocument();
    expect(screen.getByText("Add your first product.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("renders nothing without results", () => {
    const { container } = render(<Pagination page={1} pages={1} total={0} pageSize={10} onPage={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reports the visible range and navigates", async () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pages={4} total={35} pageSize={10} onPage={onPage} />);
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 11–20 of 35");
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPage).toHaveBeenNthCalledWith(1, 1);
    expect(onPage).toHaveBeenNthCalledWith(2, 3);
  });
});

describe("Modal", () => {
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <Modal open={open} onClose={() => setOpen(false)} title="Refund purchase" footer={<button>Confirm</button>}>
        <p>Modal body</p>
      </Modal>
    );
  }

  it("renders a labelled dialog with content and footer", () => {
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Refund purchase" })).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("closes on Escape and backdrop click", async () => {
    render(<Harness />);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ThemeToggle", () => {
  it("persists and applies the selected theme", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("button", { name: "Use dark theme" });
    await userEvent.click(toggle);
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("smartvend_theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Use light theme" })).toBeInTheDocument();
  });
});
