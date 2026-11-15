import { api } from "./client";

export const catalogService = {
  async getCatalog(machineId) {
    const { data } = await api.get("/catalog", {
      params: machineId ? { machine_id: machineId } : {},
    });
    return data;
  },
  async getMachines() {
    const { data } = await api.get("/catalog/machines");
    return data;
  },
};
