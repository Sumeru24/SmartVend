import { api, createIdempotencyKey } from "./client";

export const transactionService = {
  async create({ machineId, items }) {
    const key = createIdempotencyKey("cart");
    const { data } = await api.post(
      "/transactions",
      {
        machine_id: machineId,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        idempotency_key: key,
      },
      { headers: { "X-Idempotency-Key": key } },
    );
    return data;
  },
  async pay(reference, { method, amountPaise, simulateFailure = false, upiVpa }) {
    const key = createIdempotencyKey("pay");
    const { data } = await api.post(
      `/transactions/${reference}/payments`,
      {
        method,
        amount_paise: amountPaise,
        simulate_failure: simulateFailure,
        upi_vpa: upiVpa,
        idempotency_key: key,
      },
      { headers: { "X-Idempotency-Key": key } },
    );
    return data;
  },
  async dispense(reference) {
    const key = createIdempotencyKey("dispense");
    const { data } = await api.post(
      `/transactions/${reference}/dispense`,
      { idempotency_key: key },
      { headers: { "X-Idempotency-Key": key } },
    );
    return data;
  },
  async cancel(reference, reason) {
    const { data } = await api.post(`/transactions/${reference}/cancel`, { reason });
    return data;
  },
  async reset(reference) {
    const { data } = await api.post(`/transactions/${reference}/reset`);
    return data;
  },
  async get(reference) {
    const { data } = await api.get(`/transactions/${reference}`);
    return data;
  },
  async getReceipt(reference) {
    const { data } = await api.get(`/transactions/${reference}/receipt`);
    return data;
  },
  async history(references) {
    if (!references.length) return [];
    const { data } = await api.get("/transactions/history", {
      params: { refs: references.join(",") },
    });
    return data;
  },
};
