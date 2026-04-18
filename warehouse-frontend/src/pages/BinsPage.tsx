import { useState } from "react";
import { BinCreate } from "../components/BinCreate";
import { useBinsByWarehouse, useRenameBin } from "../hooks/queries/useBins";
import { useWarehouses } from "../hooks/queries/useWarehouses";
import { getApiErrorMessage } from "../lib/api";

export function BinsPage() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [editingBinId, setEditingBinId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const warehousesQuery = useWarehouses();
  const binsQuery = useBinsByWarehouse(selectedWarehouseId);
  const renameMutation = useRenameBin();

  // Filter to only warehouses with use_bins = true
  const binsEnabledWarehouses = (warehousesQuery.data || []).filter(
    (w: any) => w.use_bins === true,
  );

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    setEditingBinId(null);
  };

  const startEdit = (bin: { id: string; name: string }) => {
    setEditingBinId(bin.id);
    setEditName(bin.name);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingBinId(null);
    setEditError(null);
  };

  const saveEdit = async (binId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Name is required");
      return;
    }
    try {
      await renameMutation.mutateAsync({ id: binId, name: trimmed });
      setEditingBinId(null);
    } catch (err) {
      setEditError(getApiErrorMessage(err, "Failed to rename bin"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Bins </h1>
            <p className="mt-2 text-sm text-gray-600">
              Create and manage bins/shelves for your warehouses
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create bin form */}
          <div className="bg-white rounded-lg shadow p-6">
            <BinCreate />
          </div>

          {/* Bins list */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Bins by Warehouse
            </h2>

            {warehousesQuery.isLoading ? (
              <div className="text-center text-gray-500">
                Loading warehouses...
              </div>
            ) : warehousesQuery.isError ? (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Failed to load warehouses
                    </h3>
                  </div>
                </div>
              </div>
            ) : binsEnabledWarehouses.length === 0 ? (
              <div className="rounded-md bg-yellow-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      No warehouses with bins enabled
                    </h3>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label
                    htmlFor="warehouse-select"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Select Warehouse
                  </label>
                  <select
                    id="warehouse-select"
                    value={selectedWarehouseId}
                    onChange={(e) => handleWarehouseChange(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select a warehouse to view bins</option>
                    {binsEnabledWarehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedWarehouseId && (
                  <>
                    {binsQuery.isLoading ? (
                      <div className="text-center text-gray-500">
                        Loading bins...
                      </div>
                    ) : binsQuery.isError ? (
                      <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">
                              Failed to load bins
                            </h3>
                          </div>
                        </div>
                      </div>
                    ) : (binsQuery.data || []).length === 0 ? (
                      <div className="rounded-md bg-blue-50 p-4">
                        <div className="flex">
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-blue-800">
                              No bins yet. Create one using the form.
                            </h3>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(binsQuery.data || []).map((bin: any) => (
                          <div
                            key={bin.id}
                            className="border border-gray-200 rounded-lg p-3"
                          >
                            {editingBinId === bin.id ? (
                              <div>
                                <input
                                  autoFocus
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEdit(bin.id);
                                    if (e.key === "Escape") cancelEdit();
                                  }}
                                  className="block w-full px-2 py-1 border border-blue-400 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {editError && (
                                  <p className="text-xs text-red-600 mt-1">
                                    {editError}
                                  </p>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => saveEdit(bin.id)}
                                    disabled={renameMutation.isPending}
                                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <div>
                                  <h3 className="font-medium text-gray-900">
                                    {bin.name}
                                  </h3>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Created:{" "}
                                    {new Date(
                                      bin.created_at,
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                                <button
                                  onClick={() => startEdit(bin)}
                                  className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded px-2 py-1 hover:border-blue-400 transition-colors"
                                  title="Rename bin"
                                >
                                  Rename
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
