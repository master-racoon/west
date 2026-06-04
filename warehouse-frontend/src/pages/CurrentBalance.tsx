import { useEffect, useState } from "react";
import {
  useInventoryCurrentBalance,
  type CurrentBalanceFilter,
} from "../hooks/queries/useInventory";

import { useWarehouses } from "../hooks/queries/useWarehouses";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function CurrentBalancePage() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [skuInput, setSkuInput] = useState("");
  const debouncedSku = useDebounce(skuInput, 300);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: warehouses } = useWarehouses();

  const filters: CurrentBalanceFilter = {};
  if (selectedWarehouseId) filters.warehouse_id = selectedWarehouseId;
  if (debouncedSku) filters.sku = debouncedSku;

  const { data, isLoading, error } = useInventoryCurrentBalance(filters);

  function toggleItem(itemId: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Current Balance</h1>
          <p className="mt-2 text-sm text-gray-600">
            Current stock levels per item, grouped by warehouse and bin.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Warehouses</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={skuInput}
            onChange={(e) => setSkuInput(e.target.value)}
            placeholder="Filter by SKU..."
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={async () => {
              const qs = new URLSearchParams();
              if (selectedWarehouseId)
                qs.set("warehouse_id", selectedWarehouseId);
              if (debouncedSku) qs.set("sku", debouncedSku);
              const query = qs.toString();
              const url = `${import.meta.env.VITE_API_URL ?? ""}/api/inventory/current-balance.csv${
                query ? `?${query}` : ""
              }`;
              const token =
                localStorage.getItem("user_session_token") ||
                localStorage.getItem("session_token");

              try {
                const res = await fetch(url, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) {
                  // eslint-disable-next-line no-console
                  console.error("Failed to download CSV", res.status);
                  return;
                }
                const blob = await res.blob();
                const link = document.createElement("a");
                const objectUrl = URL.createObjectURL(blob);
                link.href = objectUrl;
                link.download = "current-balance.csv";
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(objectUrl);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error(err);
              }
            }}
            className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm shadow-sm hover:bg-blue-700"
          >
            Download CSV
          </button>
        </div>

        {isLoading && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load balance data. Please try again.
          </div>
        )}

        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No inventory found
          </div>
        )}

        {!isLoading && !error && data && data.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    SKU(s)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Total Qty
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => {
                  const isExpanded = expandedItems.has(item.item_id);
                  return (
                    <BalanceItemRows
                      key={item.item_id}
                      item={item}
                      isExpanded={isExpanded}
                      onToggle={() => toggleItem(item.item_id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface BalanceItemRowsProps {
  item: {
    item_id: string;
    item_name: string;
    skus: string[];
    total_quantity: number;
    warehouses: {
      warehouse_id: string;
      warehouse_name: string;
      quantity: number;
      bins: { bin_id: string; bin_name: string; quantity: number }[];
    }[];
  };
  isExpanded: boolean;
  onToggle: () => void;
}

function BalanceItemRows({ item, isExpanded, onToggle }: BalanceItemRowsProps) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-sm font-medium text-gray-900">
          <span className="mr-2 text-gray-400 text-xs">
            {isExpanded ? "▼" : "▶"}
          </span>
          {item.item_name}
        </td>
        <td className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-blue-700">
          {item.skus.length > 0 ? (
            item.skus.join(", ")
          ) : (
            <span className="text-gray-400 normal-case tracking-normal">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
          {item.total_quantity}
        </td>
      </tr>

      {isExpanded &&
        item.warehouses.map((wh) => (
          <WarehouseRows
            key={`${item.item_id}-${wh.warehouse_id}`}
            warehouse={wh}
          />
        ))}
    </>
  );
}

interface WarehouseRowsProps {
  warehouse: {
    warehouse_id: string;
    warehouse_name: string;
    quantity: number;
    bins: { bin_id: string; bin_name: string; quantity: number }[];
  };
}

function WarehouseRows({ warehouse }: WarehouseRowsProps) {
  return (
    <>
      <tr className="bg-blue-50">
        <td
          className="pl-10 pr-4 py-2 text-sm text-gray-700 font-medium"
          colSpan={2}
        >
          {warehouse.warehouse_name}
        </td>
        <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
          {warehouse.quantity}
        </td>
      </tr>
      {warehouse.bins.map((b) => (
        <tr key={b.bin_id} className="bg-blue-50/50">
          <td className="pl-16 pr-4 py-1.5 text-xs text-gray-500" colSpan={2}>
            {b.bin_name}
          </td>
          <td className="px-4 py-1.5 text-xs text-gray-700 text-right">
            {b.quantity}
          </td>
        </tr>
      ))}
    </>
  );
}
