import { ImagePlus, Link2, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { Toggle } from "../../components/ui/Toggle";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import { formatCurrency } from "../../utils/format";

const emptyForm = {
  name: "",
  sku: "",
  category_id: "",
  price: "",
  description: "",
  image_url: "",
  initial_stock: "12",
  low_stock_threshold: "5",
  is_active: true,
};

function rupeesToPaise(value) {
  const normalised = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  const [whole, fraction = ""] = normalised.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function ProductFormModal({ open, onClose, product, categories, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const { success, error: toastError } = useToast();
  const isEditing = Boolean(product);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        category_id: String(product.category_id),
        price: (product.price_paise / 100).toFixed(product.price_paise % 100 === 0 ? 0 : 2),
        description: product.description || "",
        image_url: product.image_url || "",
        initial_stock: String(product.total_stock || 0),
        low_stock_threshold: "5",
        is_active: product.is_active,
      });
    } else {
      setForm({
        ...emptyForm,
        category_id: categories?.[0]?.id ? String(categories[0].id) : "",
      });
    }
  }, [open, product, categories]);

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const data = await adminService.uploadImage(file);
      setForm((current) => ({ ...current, image_url: data.url }));
      success("Product image uploaded.");
    } catch (err) {
      const message = apiErrorMessage(err, "Image upload failed.");
      setError(message);
      toastError(message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const pricePaise = rupeesToPaise(form.price);
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Enter a product name with at least 2 characters.");
      return;
    }
    if (!form.sku.trim() || form.sku.trim().length < 2) {
      setError("Enter a SKU with at least 2 characters.");
      return;
    }
    if (!form.category_id) {
      setError("Choose a category.");
      return;
    }
    if (!pricePaise) {
      setError("Enter a valid price greater than ₹0 with up to 2 decimals.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category_id: Number(form.category_id),
      price_paise: pricePaise,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      is_active: form.is_active,
    };
    if (!isEditing) {
      payload.initial_stock = Number(form.initial_stock);
      payload.low_stock_threshold = Number(form.low_stock_threshold);
    }
    setSaving(true);
    try {
      if (isEditing) {
        await adminService.updateProduct(product.id, payload);
        success("Product updated.");
      } else {
        await adminService.createProduct(payload);
        success("Product added to every machine.");
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the product.");
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEditing ? "Edit product" : "Add a new product"}
      description={
        isEditing
          ? "Changes apply to the catalog and all live machine listings."
          : "Set the price once — stock is initialised across all registered machines."
      }
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="product-form" className="btn-primary" disabled={saving}>
            {saving && <Spinner className="h-4 w-4" />}
            {isEditing ? "Save changes" : "Create product"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="grid gap-5 sm:grid-cols-[1fr_180px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="product-name">
                Product name
              </label>
              <input
                id="product-name"
                className="input"
                value={form.name}
                onChange={update("name")}
                placeholder="e.g. Alphonso Mango Nectar"
                maxLength={150}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="product-sku">
                SKU
              </label>
              <input
                id="product-sku"
                className="input font-mono uppercase"
                value={form.sku}
                onChange={update("sku")}
                placeholder="SV-MNG-013"
                maxLength={50}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="product-category">
                Category
              </label>
              <select
                id="product-category"
                className="input"
                value={form.category_id}
                onChange={update("category_id")}
                required
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="product-price">
                Price (₹)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400">
                  ₹
                </span>
                <input
                  id="product-price"
                  className="input pl-8 font-mono"
                  value={form.price}
                  onChange={update("price")}
                  placeholder="45.00"
                  inputMode="decimal"
                  required
                />
              </div>
              {rupeesToPaise(form.price) > 0 && (
                <p className="field-hint">
                  Stored as {rupeesToPaise(form.price)} integer paise ·{" "}
                  {formatCurrency(rupeesToPaise(form.price))}
                </p>
              )}
            </div>
            {!isEditing ? (
              <div>
                <label className="label" htmlFor="product-stock">
                  Initial stock per machine
                </label>
                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  max="10000"
                  className="input font-mono"
                  value={form.initial_stock}
                  onChange={update("initial_stock")}
                />
              </div>
            ) : (
              <div>
                <label className="label">Current aggregate stock</label>
                <div className="input flex items-center bg-ink-50 font-mono text-ink-500 dark:bg-white/[0.03]">
                  {product.total_stock} units
                </div>
                <p className="field-hint">Use the Inventory page to restock.</p>
              </div>
            )}
            {!isEditing && (
              <div>
                <label className="label" htmlFor="product-threshold">
                  Low-stock threshold
                </label>
                <input
                  id="product-threshold"
                  type="number"
                  min="0"
                  max="10000"
                  className="input font-mono"
                  value={form.low_stock_threshold}
                  onChange={update("low_stock_threshold")}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label" htmlFor="product-description">
                Description
              </label>
              <textarea
                id="product-description"
                className="input min-h-[92px] resize-y"
                value={form.description}
                onChange={update("description")}
                maxLength={2000}
                placeholder="A short, appetising description shown on the vending screen."
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="product-image">
              Image URL
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="product-image"
                className="input pl-10"
                value={form.image_url}
                onChange={update("image_url")}
                placeholder="https://… or upload below"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className={`btn-secondary cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload image"}
              </label>
              <span className="text-[10px] text-ink-400">JPEG, PNG or WebP · max 5 MB</span>
            </div>
          </div>

          <Toggle
            id="product-active"
            checked={form.is_active}
            onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
            label="Visible to customers"
            description="Inactive products remain in history but cannot be purchased."
          />

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="order-first sm:order-none">
          <label className="label">Preview</label>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-lime-100 via-ink-50 to-white dark:border-white/10 dark:from-volt/10 dark:via-white/[0.03] dark:to-transparent">
            {form.image_url ? (
              <img
                src={form.image_url}
                alt="Product preview"
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-ink-300">
                <ImagePlus className="h-8 w-8" />
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider">
                  Image preview
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/60 to-transparent p-3">
              <p className="truncate text-xs font-bold text-white">
                {form.name || "Product name"}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-white/60">
                {rupeesToPaise(form.price) ? formatCurrency(rupeesToPaise(form.price)) : "₹0"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
            Images are displayed on the customer vending touchscreen. Uploaded assets are served
            from the API’s static directory.
          </p>
        </div>
      </form>
    </Modal>
  );
}
