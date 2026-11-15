import { describe, expect, it } from "vitest";
import {
  FS_STATE_COLORS,
  STATE_META,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  initials,
  relativeTime,
  stateLabel,
  titleCase,
} from "../utils/format";

describe("formatCurrency", () => {
  it("formats integer paise as Indian rupees", () => {
    expect(formatCurrency(0)).toMatch(/₹0/);
    expect(formatCurrency(12345)).toMatch(/₹123\.45/);
    expect(formatCurrency(50000)).toMatch(/₹500/);
  });

  it("handles missing values and compact notation", () => {
    expect(formatCurrency(undefined)).toMatch(/₹0/);
    expect(formatCurrency(15000000, { compact: true })).toMatch(/₹1\.5/);
  });
});

describe("number and date helpers", () => {
  it("groups numbers using the Indian numbering system", () => {
    expect(formatNumber(1234567)).toBe("12,34,567");
    expect(formatNumber(null)).toBe("0");
  });

  it("renders an em dash for missing dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("formats valid dates without throwing", () => {
    expect(formatDate("2026-01-15T10:30:00Z")).toMatch(/2026/);
    expect(formatDateTime("2026-01-15T10:30:00Z")).toMatch(/2026/);
  });

  it("produces relative timestamps", () => {
    expect(relativeTime(new Date().toISOString())).toBe("just now");
    expect(relativeTime(new Date(Date.now() - 5 * 60 * 1000).toISOString())).toBe("5m ago");
    expect(relativeTime(null)).toBe("");
  });
});

describe("label helpers", () => {
  it("converts enum-like values to title case", () => {
    expect(titleCase("PAYMENT_PENDING")).toBe("Payment Pending");
    expect(titleCase("")).toBe("");
  });

  it("builds initials", () => {
    expect(initials("Aarav Mehta")).toBe("AM");
    expect(initials("")).toBe("SV");
    expect(initials("operator")).toBe("O");
  });

  it("maps every FSM state to a human label and colour", () => {
    expect(Object.keys(STATE_META)).toHaveLength(13);
    expect(stateLabel("OUT_OF_STOCK")).toBe("Out of stock");
    expect(stateLabel("SOMETHING_NEW")).toBe("Something New");
    expect(FS_STATE_COLORS.COMPLETED).toMatch(/^#/);
  });
});
