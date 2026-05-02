import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useItemById,
  useItemBalance,
  useItemMovements,
} from "../hooks/queries/useItems";

type Tab = "availability" | "movements";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ADD: "Add",
  REMOVE: "Remove",
  TRANSFER: "Transfer",
  COUNT_ADJUSTMENT: "Count Adjust",
  MANUAL_ADJUSTMENT: "Manual Adjust",
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  ADD: "text-green-700 bg-green-50",
  REMOVE: "text-red-700 bg-red-50",
  TRANSFER: "text-blue-700 bg-blue-50",
  COUNT_ADJUSTMENT: "text-amber-700 bg-amber-50",
  MANUAL_ADJUSTMENT: "text-purple-700 bg-purple-50",
};

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  return date.toLocaleString();
}

function isRecent(ts: string) {
  return Date.now() - new Date(ts).getTime() < 3600000; // 1 hour
}

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("availability");
  const [movementOffset, setMovementOffset] = useState(0);
  const movementLimit = 20;

  const {
    data: itemData,
    isLoading: itemLoading,
    error: itemError,
  } = useItemById(id ?? null);
  const {
    data: balance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useItemBalance(id ?? null);
  const {
    data: movementsData,
    isLoading: movementsLoading,
    error: movementsError,
  } = useItemMovements(id ?? null, movementLimit, movementOffset);

  if (itemLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        Loading item...
      </div>
    );
  }

  if (itemError || !itemData) {
    return (
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 text-sm">
          Item not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-3 text-sm text-blue-600 hover:underline"
          >
            ← Back to search
          </button>
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {itemData.name}
          </h1>
          {itemData.skus.length > 0 && (
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-blue-700">
              SKUs: {itemData.skus.join(", ")}
            </p>
          )}
          {itemData.description && (
            <p className="mt-1 text-sm text-gray-600">{itemData.description}</p>
          )}
          {itemData.barcodes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {itemData.barcodes.map((bc) => (
                <span
                  key={bc}
                  className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700"
                >
                  {bc}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-6">
            {(["availability", "movements"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {tab === "availability" ? "Availability" : "Movement History"}
              </button>
            ))}
          </nav>
        </div>

        {/* Availability Tab */}
        {activeTab === "availability" && (
          <div>
            {balanceLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">
                Loading balance...
              </div>
            ) : balanceError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Failed to load balance. Please try again.
              </div>
            ) : !balance || balance.warehouses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
                No stock in any warehouse
              </div>
            ) : (
              <div className="space-y-4">
                {balance.warehouses.map((wh) => (
                  <div
                    key={wh.warehouse_id}
                    className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <span className="font-medium text-gray-900">
                        {wh.warehouse_name}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        {wh.total_quantity} total
                      </span>
                    </div>
                    {wh.bins.length > 0 ? (
                      <ul className="divide-y divide-gray-100">
                        {wh.bins.map((bn) => (
                          <li
                            key={bn.bin_id}
                            className="flex items-center justify-between px-4 py-2.5 text-sm"
                          >
                            <span className="text-gray-700">{bn.bin_name}</span>
                            <span className="font-medium text-gray-900">
                              {bn.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-2.5 text-sm text-gray-400 italic">
                        No bin breakdown
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Movements Tab */}
        {activeTab === "movements" && (
          <div>
            {movementsLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">
                Loading movements...
              </div>
            ) : movementsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Failed to load movement history. Please try again.
              </div>
            ) : !movementsData || movementsData.movements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
                No movements recorded
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          User
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          Route
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {movementsData.movements.map((mv) => (
                        <tr
                          key={mv.movement_id}
                          className={
                            isRecent(mv.timestamp) ? "bg-blue-50/30" : ""
                          }
                        >
                          <td
                            className={`px-4 py-3 whitespace-nowrap ${
                              isRecent(mv.timestamp)
                                ? "font-semibold text-gray-900"
                                : "text-gray-600"
                            }`}
                          >
                            {formatTimestamp(mv.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                MOVEMENT_TYPE_COLORS[mv.type] ??
                                "text-gray-700 bg-gray-100"
                              }`}
                            >
                              {MOVEMENT_TYPE_LABELS[mv.type] ?? mv.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {mv.user_name}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {mv.quantity}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {mv.source_warehouse_name && mv.dest_warehouse_name
                              ? `${mv.source_warehouse_name}${mv.source_bin_name ? ` / ${mv.source_bin_name}` : ""} → ${mv.dest_warehouse_name}${mv.dest_bin_name ? ` / ${mv.dest_bin_name}` : ""}`
                              : mv.source_warehouse_name
                                ? `From: ${mv.source_warehouse_name}${mv.source_bin_name ? ` / ${mv.source_bin_name}` : ""}`
                                : mv.dest_warehouse_name
                                  ? `To: ${mv.dest_warehouse_name}${mv.dest_bin_name ? ` / ${mv.dest_bin_name}` : ""}`
                                  : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                            {mv.note ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {movementsData.total > movementLimit && (
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                    <span>
                      Showing {movementOffset + 1}–
                      {Math.min(
                        movementOffset + movementLimit,
                        movementsData.total,
                      )}{" "}
                      of {movementsData.total}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={movementOffset === 0}
                        onClick={() =>
                          setMovementOffset(
                            Math.max(0, movementOffset - movementLimit),
                          )
                        }
                        className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        disabled={
                          movementOffset + movementLimit >= movementsData.total
                        }
                        onClick={() =>
                          setMovementOffset(movementOffset + movementLimit)
                        }
                        className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
