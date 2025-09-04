import React, { useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { useToastStore, type Toast } from "../../stores/appStore";
import { cn } from "../../utils/cn";

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isLeaving, setIsLeaving] = React.useState(false);

  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200";
      case "error":
        return "bg-red-50 dark:bg-red-900/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900/80 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200";
      case "info":
      default:
        return "bg-blue-50 dark:bg-blue-900/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200";
    }
  };

  const getIcon = () => {
    const iconClass = "w-5 h-5 flex-shrink-0";
    switch (toast.type) {
      case "success":
        return (
          <CheckCircle
            className={cn(iconClass, "text-green-600 dark:text-green-400")}
          />
        );
      case "error":
        return (
          <XCircle
            className={cn(iconClass, "text-red-600 dark:text-red-400")}
          />
        );
      case "warning":
        return (
          <AlertCircle
            className={cn(iconClass, "text-yellow-600 dark:text-yellow-400")}
          />
        );
      case "info":
      default:
        return (
          <Info className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />
        );
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-auto max-w-sm w-full border rounded-lg shadow-lg transition-all duration-200 transform",
        getToastStyles(),
        isVisible && !isLeaving
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0",
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          {/* Icon */}
          <div className="flex-shrink-0 mr-3">{getIcon()}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium">{toast.title}</h4>
            {toast.message && (
              <p className="mt-1 text-sm opacity-90">{toast.message}</p>
            )}

            {/* Action button */}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="mt-2 text-sm font-medium underline hover:no-underline transition-all duration-200"
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-3 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-200"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToastContainer;
