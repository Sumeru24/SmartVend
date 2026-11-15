import axios from "axios";

const TOKEN_KEY = "smartvend_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && getToken()) {
      clearToken();
      window.dispatchEvent(new Event("smartvend:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error, fallback = "Something went wrong.") {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") {
    if (Array.isArray(data.errors) && data.errors.length) {
      const details = data.errors
        .map((item) => item.message)
        .filter(Boolean)
        .join(" ");
      return details ? `${data.detail} ${details}` : data.detail;
    }
    return data.detail;
  }
  if (Array.isArray(data?.detail)) return data.detail.map((e) => e.msg).join(" ");
  if (error?.code === "ECONNABORTED")
    return "The server took too long to respond. Please retry.";
  if (!error?.response) return "Cannot reach the SmartVend server. Is the API running?";
  return fallback;
}

export function createIdempotencyKey(prefix = "op") {
  const random = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

export async function downloadFile(path, filename, params = {}) {
  const response = await api.get(path, { params, responseType: "blob" });
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = match?.[1] || filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
