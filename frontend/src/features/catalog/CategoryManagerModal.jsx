import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";

const COLORS = ["#84cc16", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#10b981", "#f97316"];

export function CategoryManagerModal({ open, onClose, categories, onChanged }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { success, error: toastError } = useToast();

  const reset = () => {
    setName("");
    setDescription("");
    setColor(COLORS[0]);
    setEditing(null);
    setError("");
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Category name must have at least 2 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await adminService.updateCategory(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
        success("Category updated.");
      } else {
        await adminService.createCategory({
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
        success("Category created.");
      }
      reset();
      await onChanged();
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save category.");
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description || "");
    setColor(category.color);
    setError("");
  };

  const remove = async (category) => {
    if (!window.confirm(`Delete “${category.name}”? Only empty categories can be deleted.`)) return;
    try {
      await adminService.deleteCategory(category.id);
      success("Category deleted.");
      if (editing?.id === category.id) reset();
      await onChanged();
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not delete category."));
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Manage categories"
      description="Categories power the customer filters and analytics grouping."
      size="lg"
    >
      <div className="grid gap-6 sm:grid-cols-[230px_1fr]">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="section-kicker mb-3">{editing ? "Edit category" : "New category"}</p>
            <label className="label" htmlFor="category-name">
              Name
            </label>
            <input
              id="category-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Breakfast"
              maxLength={100}
            />
          </div>
          <div>
            <label className="label" htmlFor="category-description">
              Description
            </label>
            <textarea
              id="category-description"
              className="input min-h-[70px] resize-y"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional short description"
              maxLength={500}
            />
          </div>
          <div>
            <span className="label">Accent</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  className={`h-7 w-7 rounded-full transition ${
                    color === item ? "ring-2 ring-ink-950 ring-offset-2 dark:ring-white dark:ring-offset-[#121710]" : ""
                  }`}
                  style={{ background: item }}
                  aria-label={`Choose ${item}`}
                />
              ))}
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {editing && (
              <button type="button" className="btn-secondary" onClick={reset}>
                <X className="h-4 w-4" /> Clear
              </button>
            )}
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Update" : "Create"}
            </button>
          </div>
        </form>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="section-kicker">Existing categories</p>
            <span className="text-[10px] font-bold text-ink-400">{categories.length} total</span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  editing?.id === category.id
                    ? "border-ink-300 bg-ink-50 dark:border-white/20 dark:bg-white/[0.05]"
                    : "border-ink-100 dark:border-white/[0.07]"
                }`}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-xl"
                  style={{ background: `${category.color}20`, border: `1px solid ${category.color}55` }}
                >
                  <span
                    className="m-2.5 block h-3 w-3 rounded-full"
                    style={{ background: category.color }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink-800 dark:text-ink-100">
                    {category.name}
                  </p>
                  <p className="truncate text-[10px] text-ink-400">
                    {category.product_count} products {category.description ? `· ${category.description}` : ""}
                  </p>
                </div>
                <button
                  className="btn-icon h-7 w-7 border-transparent bg-transparent"
                  onClick={() => edit(category)}
                  aria-label={`Edit ${category.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  className="btn-icon h-7 w-7 border-transparent bg-transparent text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  onClick={() => remove(category)}
                  aria-label={`Delete ${category.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!categories.length && (
              <p className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-xs text-ink-400 dark:border-white/10">
                No categories yet. Create one to start.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
