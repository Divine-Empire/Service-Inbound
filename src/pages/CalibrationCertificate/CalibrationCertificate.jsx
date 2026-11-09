import { Award } from "lucide-react";

// Calibration Certificate is not connected to any table yet - it will be planned later
// Placeholder page until then.
export default function CalibrationCertificate() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <Award className="h-10 w-10 text-slate-400" aria-hidden="true" />
      <h2 className="text-xl font-semibold text-slate-800">Calibration Certificate</h2>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Coming soon
      </span>
      <p className="max-w-md text-sm text-slate-500">
        This stage is being planned and is not connected yet. It will be available in a future update.
      </p>
    </div>
  );
}
