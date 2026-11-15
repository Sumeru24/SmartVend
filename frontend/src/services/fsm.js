import { api } from "./client";

export const fsmService = {
  async getModel() {
    const { data } = await api.get("/fsm/model");
    return data;
  },
  async step({ state, event, context, payload }) {
    const { data } = await api.post("/fsm/simulate/step", {
      state,
      event,
      context,
      payload,
    });
    return data;
  },
};
