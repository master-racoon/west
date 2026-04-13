import { useState } from "react";
import { BinCreate } from "../components/BinCreate";
import { useBinsByWarehouse } from "../hooks/queries/useBins";
import { useWarehouses } from "../hooks/queries/useWarehouses";

export function BinsPage() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  const warehousesQuery = useWarehouses();
  const binsQuery = useBinsByWarehouse(selectedWarehouseId);

  // Filter to only warehouses with use_bins = true
  const binsEnabledWarehouses = (warehousesQuery.data || []).filter(
    (w: any) => w.use_bins === true,
  );

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
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
                            className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {bin.name}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                  ID: {bin.id}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Created:{" "}
                                  {new Date(
                                    bin.created_at,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <button className="text-sm text-gray-500 hover:text-gray-700">
                                  • • •
                                </button>
                              </div>
                            </div>
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
