import { describe, expect, it } from "vitest";
import {
  apiErrorMessage,
  clearToken,
  createIdempotencyKey,
  getToken,
  setToken,
} from "../services/client";

describe("token storage", () => {
  it("stores, reads and clears the JWT", () => {
    expect(getToken()).toBeNull();
    setToken("header.payload.signature");
    expect(getToken()).toBe("header.payload.signature");
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe("apiErrorMessage", () => {
  it("prefers a detail string", () => {
    const error = { response: { data: { detail: "Transaction is already completed." } } };
    expect(apiErrorMessage(error)).toBe("Transaction is already completed.");
  });

  it("appends structured validation errors to a detail message", () => {
    const error = {
      response: {
        data: {
          detail: "Validation failed.",
          errors: [{ message: "quantity must be positive" }],
        },
      },
    };
    expect(apiErrorMessage(error)).toBe("Validation failed. quantity must be positive");
  });

  it("joins FastAPI validation detail arrays", () => {
    const error = {
      response: { data: { detail: [{ msg: "field required" }, { msg: "invalid" }] } },
    };
    expect(apiErrorMessage(error)).toBe("field required invalid");
  });

  it("explains timeouts and unreachable servers", () => {
    expect(apiErrorMessage({ code: "ECONNABORTED" })).toMatch(/took too long/);
    expect(apiErrorMessage({})).toMatch(/Cannot reach/);
  });

  it("falls back for unknown server errors", () => {
    expect(apiErrorMessage({ response: { status: 500, data: {} } }, "Try again.")).toBe(
      "Try again.",
    );
  });
});

describe("createIdempotencyKey", () => {
  it("includes the prefix and is unique per call", () => {
    const first = createIdempotencyKey("purchase");
    const second = createIdempotencyKey("purchase");
    expect(first).toMatch(/^purchase-/);
    expect(second).toMatch(/^purchase-/);
    expect(first).not.toBe(second);
  });
});
