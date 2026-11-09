import { createElement } from "react";
import hotToast from "react-hot-toast";

// The app has one toast system: react-hot-toast (<Toaster /> in app/providers.jsx).
// Pages written for the old shadcn toaster still call
//   const { toast } = useToast(); toast({ title, description, variant })
// so this keeps that API and forwards to react-hot-toast.
// variant: "destructive" -> error, "success" -> success, anything else -> plain.

function render(title, description) {
  if (!description) return title ?? "";
  return createElement(
    "div",
    null,
    title ? createElement("p", { className: "font-semibold" }, title) : null,
    createElement("p", { className: "text-sm text-slate-600" }, description)
  );
}

function toast({ title, description, variant, duration, id } = {}) {
  const show = variant === "destructive" ? hotToast.error : variant === "success" ? hotToast.success : hotToast;
  const toastId = show(render(title, description), { id, duration });
  return {
    id: toastId,
    dismiss: () => hotToast.dismiss(toastId),
    update: (props) => toast({ title, description, variant, duration, ...props, id: toastId }),
  };
}

function useToast() {
  return { toast, dismiss: (toastId) => hotToast.dismiss(toastId) };
}

export { useToast, toast };
