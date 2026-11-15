import { api, clearToken, setToken } from "./client";

export const authService = {
  async login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.access_token);
    return data;
  },
  async me() {
    const { data } = await api.get("/auth/me");
    return data;
  },
  logout() {
    clearToken();
  },
};
