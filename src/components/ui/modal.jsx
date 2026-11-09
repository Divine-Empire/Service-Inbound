import { X } from "lucide-react";
import { Button } from "../../components/ui/button";

export function Modal({ isOpen, onClose, title, children, size = "2xl" }) {
  if (!isOpen) return null;

  const sizeClasses = {
    "sm": "max-w-sm",
    "md": "max-w-md", 
    "lg": "max-w-lg",
    "xl": "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl"
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full max-h-screen overflow-y-auto`}>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800" data-testid="modal-title">
              {title}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
