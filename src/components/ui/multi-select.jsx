import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

// Lightweight checkbox-dropdown. `value` is an array of selected option
// strings; an empty array means "no filter" (everything passes).
export function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = "All",
  className,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (opt) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-blue-200 bg-white px-3 text-sm shadow-sm"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-60 w-full min-w-[180px] overflow-y-auto rounded-md border border-blue-200 bg-white p-1 shadow-lg">
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-gray-400">No options</div>
          ) : (
            <>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full rounded px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50"
                >
                  Clear selection
                </button>
              )}
              {options.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-blue-50"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(opt)}
                    onChange={() => toggle(opt)}
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
