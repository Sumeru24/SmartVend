import { api, downloadFile } from "./client";

export const adminService = {
  async dashboard() {
    const { data } = await api.get("/admin/analytics/dashboard");
    return data;
  },
  async revenue(period = "daily") {
    const { data } = await api.get("/admin/analytics/revenue", { params: { period } });
    return data;
  },
  async productAnalytics() {
    const { data } = await api.get("/admin/analytics/products");
    return data;
  },
  async categoryAnalytics() {
    const { data } = await api.get("/admin/analytics/categories");
    return data;
  },
  async paymentAnalytics() {
    const { data } = await api.get("/admin/analytics/payments");
    return data;
  },
  async statusAnalytics() {
    const { data } = await api.get("/admin/analytics/statuses");
    return data;
  },
  async inventoryAnalytics() {
    const { data } = await api.get("/admin/analytics/inventory");
    return data;
  },
  async machineAnalytics() {
    const { data } = await api.get("/admin/analytics/machines");
    return data;
  },
  async products(params = {}) {
    const { data } = await api.get("/admin/products", { params });
    return data;
  },
  async createProduct(payload) {
    const { data } = await api.post("/admin/products", payload);
    return data;
  },
  async updateProduct(id, payload) {
    const { data } = await api.patch(`/admin/products/${id}`, payload);
    return data;
  },
  async deleteProduct(id) {
    const { data } = await api.delete(`/admin/products/${id}`);
    return data;
  },
  async categories() {
    const { data } = await api.get("/admin/categories");
    return data;
  },
  async createCategory(payload) {
    const { data } = await api.post("/admin/categories", payload);
    return data;
  },
  async updateCategory(id, payload) {
    const { data } = await api.patch(`/admin/categories/${id}`, payload);
    return data;
  },
  async deleteCategory(id) {
    const { data } = await api.delete(`/admin/categories/${id}`);
    return data;
  },
  async uploadImage(file, onProgress) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/admin/uploads/image", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress,
    });
    return data;
  },
  async inventory(params = {}) {
    const { data } = await api.get("/admin/inventory", { params });
    return data;
  },
  async inventorySummary(params = {}) {
    const { data } = await api.get("/admin/inventory/summary", { params });
    return data;
  },
  async inventoryLogs(params = {}) {
    const { data } = await api.get("/admin/inventory/logs", { params });
    return data;
  },
  async restock(id, quantity, reason = "Manual restock") {
    const { data } = await api.post(`/admin/inventory/${id}/restock`, {
      quantity,
      reason,
    });
    return data;
  },
  async setThreshold(id, lowStockThreshold) {
    const { data } = await api.patch(`/admin/inventory/${id}/threshold`, {
      low_stock_threshold: lowStockThreshold,
    });
    return data;
  },
  async machines() {
    const { data } = await api.get("/admin/machines");
    return data;
  },
  async createMachine(payload) {
    const { data } = await api.post("/admin/machines", payload);
    return data;
  },
  async updateMachine(id, payload) {
    const { data } = await api.patch(`/admin/machines/${id}`, payload);
    return data;
  },
  async setMachineStatus(id, status, reason) {
    const { data } = await api.patch(`/admin/machines/${id}/status`, { status, reason });
    return data;
  },
  async alerts(params = {}) {
    const { data } = await api.get("/admin/alerts", { params });
    return data;
  },
  async resolveAlert(id) {
    const { data } = await api.post(`/admin/alerts/${id}/resolve`);
    return data;
  },
  async transactions(params = {}) {
    const { data } = await api.get("/admin/transactions", { params });
    return data;
  },
  async transaction(reference) {
    const { data } = await api.get(`/admin/transactions/${reference}`);
    return data;
  },
  async refund(reference, reason) {
    const { data } = await api.post(`/admin/transactions/${reference}/refund`, { reason });
    return data;
  },
  async refunds() {
    const { data } = await api.get("/admin/transactions/refunds");
    return data;
  },
  async exportReport(format, reportType = "summary") {
    return downloadFile("/admin/reports/export", `smartvend-report.${format}`, {
      format,
      report_type: reportType,
    });
  },
};
