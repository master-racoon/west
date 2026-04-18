import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useItemSearch } from "../hooks/queries/useItems";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function InventorySearchPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();

  const {
    data: results,
    isLoading,
    isFetching,
    error,
  } = useItemSearch(debouncedQuery);

  const showSpinner = (isLoading || isFetching) && debouncedQuery.length > 0;
  const showError = !!error && debouncedQuery.length > 0;
  const showEmpty =
    !isLoading &&
    !isFetching &&
    !error &&
    debouncedQuery.length > 0 &&
    (!results || results.length === 0);
  const showResults = !error && results && results.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Inventory Explorer
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Search items by name, barcode, or ID to view stock levels and
            movement history.
          </p>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, barcode, or item ID..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {showSpinner && (
            <div className="absolute right-3 top-3.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          )}
        </div>

        {showError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to search. Please try again.
          </div>
        )}

        {!showError && showEmpty && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No items found for &ldquo;{debouncedQuery}&rdquo;
          </div>
        )}

        {showResults && (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() =>
                    navigate(`/dashboard/inventory-visibility/${item.id}`)
                  }
                  className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="truncate text-xs text-gray-500 mt-0.5">
                          {item.description}
                        </p>
                      )}
                      {item.barcodes && item.barcodes.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Barcodes: {item.barcodes.slice(0, 3).join(", ")}
                          {item.barcodes.length > 3
                            ? ` +${item.barcodes.length - 3} more`
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <span className="text-lg font-semibold text-gray-900">
                        {item.total_quantity ?? 0}
                      </span>
                      <p className="text-xs text-gray-500">in stock</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!debouncedQuery && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
            Start typing to search for items
          </div>
        )}
      </div>
    </div>
  );
}
