import {
  FolderCog,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ImageWithFallback } from "../../components/ImageWithFallback";
import { AdminFooterNote } from "../../layouts/AdminLayout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { TableSkeleton } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { CategoryManagerModal } from "../../features/catalog/CategoryManagerModal";
import { ProductFormModal } from "../../features/catalog/ProductFormModal";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import { formatCurrency, initials } from "../../utils/format";

export function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const load = async () => {
    try {
      const [productData, categoryData] = await Promise.all([
        adminService.products(),
        adminService.categories(),
      ]);
      setProducts(productData);
      setCategories(categoryData);
      setError("");
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Products · SmartVend";
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return products.filter((product) => {
      const matchesSearch =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        product.category?.name?.toLowerCase().includes(needle);
      const matchesCategory =
        categoryFilter === "all" || String(product.category_id) === String(categoryFilter);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? product.is_active : !product.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const openCreate = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const result = await adminService.deleteProduct(deleting.id);
      success(result.message);
      setDeleting(null);
      await load();
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not delete the product."));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="One catalog, every machine. Prices are stored as integer paise and stock is tracked per machine."
        actions={
          <>
            {isAdmin && (
              <button className="btn-secondary" onClick={() => setCategoryOpen(true)}>
                <FolderCog className="h-4 w-4" /> Categories
              </button>
            )}
            {isAdmin && (
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add product
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="panel-flat flex items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime-100 text-lime-800 dark:bg-volt/10 dark:text-volt">
            <span className="text-xs font-black">{products.length}</span>
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Catalog size
            </p>
            <p className="text-xs font-semibold text-ink-800 dark:text-ink-100">All products</p>
          </div>
        </div>
        <div className="panel-flat flex items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Customer-visible
            </p>
            <p className="text-xs font-semibold text-ink-800 dark:text-ink-100">
              {products.filter((product) => product.is_active).length} active
            </p>
          </div>
        </div>
        <div className="panel-flat flex items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <TriangleAlert className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Aggregate units
            </p>
            <p className="text-xs font-semibold text-ink-800 dark:text-ink-100">
              {products.reduce((total, product) => total + product.total_stock, 0)} in stock
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2.5 rounded-2xl border border-ink-200/70 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#121710] lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input border-0 bg-transparent pl-10 shadow-none focus:ring-0 dark:bg-transparent"
            placeholder="Search by name, SKU or category…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:border-l lg:border-ink-100 lg:pl-3 dark:lg:border-white/10">
          <span className="hidden text-ink-300 lg:block">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <select
            className="input w-auto bg-transparent py-2 text-xs"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="input w-auto bg-transparent py-2 text-xs"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <span className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-[10px] font-bold text-ink-500 dark:bg-white/5 dark:text-ink-300">
            {filtered.length} results
          </span>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={7} columns={5} />
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          title="Could not load products"
          description={error}
          action={
            <button className="btn-primary" onClick={load}>
              Try again
            </button>
          }
        />
      ) : filtered.length ? (
        <div className="table-shell">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  {isAdmin && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <ImageWithFallback
                          src={product.image_url}
                          alt={product.name}
                          fallbackColor={product.category?.color}
                          fallbackLabel={initials(product.name)}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0">
                          <p className="max-w-[240px] truncate text-[13px] font-bold text-ink-900 dark:text-white">
                            {product.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-ink-400">
                            {product.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="chip"
                        style={{
                          background: `${product.category?.color || "#84cc16"}14`,
                          color: product.category?.color || "#4d7c0f",
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: product.category?.color || "#84cc16" }}
                        />
                        {product.category?.name || "Uncategorised"}
                      </span>
                    </td>
                    <td>
                      <p className="font-mono text-xs font-bold text-ink-900 dark:text-white">
                        {formatCurrency(product.price_paise)}
                      </p>
                      <p className="mt-0.5 text-[9px] text-ink-400">
                        {product.price_paise} paise
                      </p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            product.total_stock <= 5
                              ? "text-rose-600 dark:text-rose-400"
                              : product.total_stock <= 15
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-ink-800 dark:text-ink-100"
                          }`}
                        >
                          {product.total_stock}
                        </span>
                        <span className="text-[10px] text-ink-400">units</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          product.is_active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-ink-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${product.is_active ? "bg-emerald-500" : "bg-ink-400"}`}
                        />
                        {product.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-icon h-8 w-8"
                            onClick={() => openEdit(product)}
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="btn-icon h-8 w-8 text-rose-500 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => setDeleting(product)}
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            icon={Search}
            title="No products match"
            description="Try a different search term or filter, or add a new product to the catalog."
            action={
              isAdmin ? (
                <button className="btn-primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add product
                </button>
              ) : null
            }
          />
        </div>
      )}

      <AdminFooterNote />

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editingProduct}
        categories={categories}
        onSaved={load}
      />
      <CategoryManagerModal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        categories={categories}
        onChanged={load}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete this product?"
        description={
          deleting
            ? `“${deleting.name}” will be removed from all machine plans. If it appears in transaction history, SmartVend archives it instead to preserve the audit trail.`
            : ""
        }
        confirmLabel="Delete product"
      />
    </div>
  );
}

export default ProductsPage;
