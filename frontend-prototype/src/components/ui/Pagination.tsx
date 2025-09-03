import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "../../utils/cn";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  maxVisiblePages?: number;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  maxVisiblePages = 5,
  className,
}) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = Math.floor(maxVisiblePages / 2);
    let start = Math.max(currentPage - delta, 1);
    let end = Math.min(start + maxVisiblePages - 1, totalPages);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(end - maxVisiblePages + 1, 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();
  const showLeftEllipsis = visiblePages[0] > 2;
  const showRightEllipsis =
    visiblePages[visiblePages.length - 1] < totalPages - 1;

  const buttonClass =
    "relative inline-flex items-center px-3 py-2 text-sm font-medium transition-colors duration-200 focus:z-20";
  const activeClass =
    "bg-blue-600 text-white border-blue-600 hover:bg-blue-700";
  const inactiveClass =
    "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700";
  const disabledClass =
    "text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 cursor-not-allowed";

  return (
    <nav
      className={cn("flex items-center justify-center", className)}
      aria-label="Pagination"
    >
      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* First page button */}
        {showFirstLast && currentPage > 1 && (
          <button
            onClick={() => onPageChange(1)}
            className={cn(buttonClass, inactiveClass, "border-r")}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
            <span className="sr-only">First page</span>
          </button>
        )}

        {/* Previous page button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            buttonClass,
            currentPage === 1 ? disabledClass : inactiveClass,
            "border-r",
          )}
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="sr-only">Previous page</span>
        </button>

        {/* First page if not in visible range */}
        {visiblePages[0] > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className={cn(buttonClass, inactiveClass, "border-r")}
            >
              1
            </button>
            {showLeftEllipsis && (
              <span
                className={cn(
                  buttonClass,
                  inactiveClass,
                  "border-r cursor-default",
                )}
              >
                ...
              </span>
            )}
          </>
        )}

        {/* Visible page numbers */}
        {visiblePages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              buttonClass,
              page === currentPage ? activeClass : inactiveClass,
              "border-r last:border-r-0",
            )}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        ))}

        {/* Last page if not in visible range */}
        {visiblePages[visiblePages.length - 1] < totalPages && (
          <>
            {showRightEllipsis && (
              <span
                className={cn(
                  buttonClass,
                  inactiveClass,
                  "border-r cursor-default",
                )}
              >
                ...
              </span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className={cn(buttonClass, inactiveClass, "border-r")}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next page button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            buttonClass,
            currentPage === totalPages ? disabledClass : inactiveClass,
            "border-r",
          )}
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="sr-only">Next page</span>
        </button>

        {/* Last page button */}
        {showFirstLast && currentPage < totalPages && (
          <button
            onClick={() => onPageChange(totalPages)}
            className={cn(buttonClass, inactiveClass)}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
            <span className="sr-only">Last page</span>
          </button>
        )}
      </div>

      {/* Page info */}
      <div className="ml-4 text-sm text-gray-700 dark:text-gray-300">
        Page <span className="font-medium">{currentPage}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </div>
    </nav>
  );
};

export default Pagination;
