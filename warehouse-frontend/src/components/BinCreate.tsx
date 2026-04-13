import { FormEvent, useState, useEffect } from "react";
import { useCreateBin } from "../hooks/queries/useBins";
import { useWarehouses } from "../hooks/queries/useWarehouses";

export function BinCreate() {
  const [warehouseId, setWarehouseId] = useState("");
  const [binName, setBinName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const warehousesQuery = useWarehouses();
  const mutation = useCreateBin();
  const isLoading = mutation.isPending || warehousesQuery.isLoading;

  // Filter to only warehouses with use_bins = true
  const binsEnabledWarehouses = (warehousesQuery.data || []).filter(
    (w: any) => w.use_bins === true,
  );

  // Auto-select first warehouse if available
  useEffect(() => {
    if (binsEnabledWarehouses.length > 0 && !warehouseId) {
      setWarehouseId(binsEnabledWarehouses[0].id);
    }
  }, [binsEnabledWarehouses, warehouseId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate inputs
    if (!warehouseId) {
      setError("Please select a warehouse");
      return;
    }

    if (!binName.trim()) {
      setError("Bin name is required");
      return;
    }

    if (binName.length > 100) {
      setError("Bin name must be 100 characters or less");
      return;
    }

    try {
      await mutation.mutateAsync({
        warehouse_id: warehouseId,
        name: binName,
      });

      setSuccess(true);
      setBinName("");

      // Find the warehouse name for the toast
      const warehouse = binsEnabledWarehouses.find(
        (w: any) => w.id === warehouseId,
      );
      const warehouseName = warehouse?.name || "Unknown warehouse";

      // Show success message with warehouse name
      console.log(`Bin created in ${warehouseName}`);

      // Reset form after a delay
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create bin";
      if (message.includes("409")) {
        setError("A bin with this name already exists in this warehouse");
      } else if (message.includes("400")) {
        setError("Bins are not enabled for this warehouse");
      } else if (message.includes("404")) {
        setError("Warehouse not found");
      } else if (message.includes("403")) {
        setError("You do not have permission to create bins");
      } else {
        setError(message);
      }
    }
  };

  if (warehousesQuery.isError) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Failed to load warehouses
            </h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900">Create a Bin</h2>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Bin created successfully!
                </h3>
              </div>
            </div>
          </div>
        )}

        {binsEnabledWarehouses.length === 0 ? (
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  No warehouses with bins enabled. Please create a warehouse
                  with bins enabled first.
                </h3>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="warehouse" className="sr-only">
                  Warehouse
                </label>
                <select
                  id="warehouse"
                  name="warehouse"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="">Select a warehouse</option>
                  {binsEnabledWarehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="binName" className="sr-only">
                  Bin Name
                </label>
                <input
                  id="binName"
                  name="binName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 border-t-0 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Bin Name (e.g., Shelf A, Bin 001)"
                  value={binName}
                  onChange={(e) => setBinName(e.target.value)}
                  maxLength={100}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating..." : "Create Bin"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
