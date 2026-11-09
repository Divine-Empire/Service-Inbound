import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "../ui/button";

// Dropdown with a checkbox per column. `fixed` columns (Action) are always shown and are
// not listed. Opens towards the left of its button, flipping to the right when the button
// sits close to the left edge (e.g. at the start of a wrapped filter row).
export function ColumnSelector({ columns, visibleKeys, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const btn = ref.current?.getBoundingClientRect();
    const popWidth = popRef.current?.offsetWidth || 256;
    // right-aligned popover would start at btn.right - popWidth
    setAlignLeft(!!btn && btn.right - popWidth < 8);
  }, [open]);

  const selectable = columns.filter((c) => !c.fixed);
  const shown = selectable.filter((c) => visibleKeys.includes(c.key)).length;

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
        data-testid="button-column-selector"
      >
        <Columns3 className="w-4 h-4 mr-2" />
        Columns ({shown}/{selectable.length})
      </Button>
      {open && (
        <div
          ref={popRef}
          className={`absolute z-30 mt-2 w-64 max-h-80 overflow-y-auto rounded-md border border-blue-200 bg-white p-2 shadow-lg ${alignLeft ? "left-0" : "right-0"}`}
        >
          <div className="flex justify-between items-center px-1 pb-2 border-b border-blue-100 mb-1">
            <span className="text-xs font-medium text-gray-600">Visible columns</span>
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-blue-600 hover:underline"
            >
              Reset
            </button>
          </div>
          {selectable.map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-2 px-1 py-1 text-sm text-gray-800 rounded hover:bg-blue-50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={visibleKeys.includes(c.key)}
                onChange={() => onToggle(c.key)}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
