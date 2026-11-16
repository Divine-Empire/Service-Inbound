import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

// The editable form of one certificate: the template's fixed fields, then its Yes / No inspection list.
// Labels are fixed; only the values change.
export default function CertificateFields({ format, values, onChange, idPrefix, hideKeys = [] }) {
  const fields = format.fields.filter((f) => !hideKeys.includes(f.key));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`${idPrefix}-${field.key}`} className="text-xs">{field.label}</Label>
            <Input
              id={`${idPrefix}-${field.key}`}
              type={field.type === "date" ? "date" : "text"}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {format.checklist && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">
            {format.checklist.title} <span className="font-normal text-muted-foreground">(select Yes or No for every row)</span>
          </p>
          <div className="overflow-hidden rounded-md border">
            {format.checklist.items.map((item, i) => (
              <div key={item.key} className={`flex items-center gap-2 px-2 py-1.5 text-xs ${i > 0 ? "border-t" : ""}`}>
                <span className="w-5 text-center text-muted-foreground">{i + 1}</span>
                <span className="flex-1">{item.label}</span>
                <div className="inline-flex overflow-hidden rounded-md border" role="group" aria-label={item.label}>
                  {["yes", "no"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={values[item.key] === opt}
                      onClick={() => onChange(item.key, values[item.key] === opt ? "" : opt)}
                      className={`px-3 py-1 font-medium capitalize ${values[item.key] === opt ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
