import { SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

/**
 * One "Filters" button that opens a dialog holding every filter (and page-level extras such
 * as Export CSV), so the list toolbar only shows tabs, search, Filters and Columns.
 * The button carries the number of active filters. Compose the body from <FilterSection>s.
 */
export default function FilterDialog({
  activeCount = 0,
  onClear,
  title = "Filters",
  description = "Narrow the list. Changes apply immediately.",
  children,
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          data-testid="button-filters"
          aria-label={activeCount ? `Filters, ${activeCount} active` : "Filters"}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded bg-primary px-1.5 text-xs font-medium tabular-nums text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">{children}</div>
        <DialogFooter className="gap-2 sm:gap-0">
          {onClear && (
            <Button type="button" variant="outline" onClick={onClear} disabled={!activeCount}>
              Clear all
            </Button>
          )}
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A titled group inside the dialog. */
export function FilterSection({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
