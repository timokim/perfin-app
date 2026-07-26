"use client";

import type { Category } from "@/lib/types";

interface CategoryPickerProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
}: CategoryPickerProps) {
  const selected = categories.find((c) => c.id === value);

  return (
    <div className="relative">
      <select
        className="select !py-1.5 !pr-8 text-sm"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value)
        }
        style={
          selected
            ? { borderColor: selected.color, boxShadow: `inset 3px 0 0 ${selected.color}` }
            : undefined
        }
      >
        <option value="">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
