import { FormEvent, useState } from "react";
import { useCreateWarehouse } from "../hooks/queries/useWarehouses";

export function WarehouseCreate() {
  const [name, setName] = useState("");
  const [useBins, setUseBins] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useCreateWarehouse();
  const isLoading = mutation.isPending;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate name
    if (!name.trim()) {
      setError("Warehouse name is required");
      return;
    }

    if (name.length > 100) {
      setError("Warehouse name must be 100 characters or less");
      return;
    }

    try {
      await mutation.mutateAsync({ name, use_bins: useBins });
      setSuccess(true);
      setName("");
      setUseBins(false);
      // In a real app, redirect to warehouse list
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create warehouse";
      if (message.includes("409")) {
        setError("A warehouse with this name already exists");
      } else if (message.includes("403")) {
        setError("You do not have permission to create warehouses");
      } else {
        setError(message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create a New Warehouse
          </h2>
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
                    Warehouse created successfully!
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="name" className="sr-only">
                Warehouse Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Warehouse Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center px-3 py-2 border border-gray-300 border-t-0 rounded-b-md">
              <input
                id="use_bins"
                name="use_bins"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={useBins}
                onChange={(e) => setUseBins(e.target.checked)}
                disabled={isLoading}
              />
              <label
                htmlFor="use_bins"
                className="ml-2 block text-sm text-gray-900"
              >
                Use bins/shelves for organization
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Warehouse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
