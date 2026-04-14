import { FormEvent, useState } from "react";
import { ApiError, getApiErrorMessage } from "../lib/api";
import {
  useCreateWarehouse,
  useUpdateWarehouse,
  useWarehouses,
  type Warehouse,
} from "../hooks/queries/useWarehouses";
import { useAuthStore } from "../stores/authStore";

export function WarehouseCreate() {
  const { user } = useAuthStore();
  const [name, setName] = useState("");
  const [useBins, setUseBins] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editUseBins, setEditUseBins] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessId, setEditSuccessId] = useState<string | null>(null);

  const warehousesQuery = useWarehouses();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const isLoading = createMutation.isPending;
  const warehouses = warehousesQuery.data || [];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Warehouse name is required");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Warehouse name must be 100 characters or less");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: trimmedName,
        use_bins: useBins,
      });
      setSuccess(true);
      setName("");
      setUseBins(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("A warehouse with this name already exists");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("You do not have permission to create warehouses");
      } else {
        setError(getApiErrorMessage(err, "Failed to create warehouse"));
      }
    }
  };

  const startEditing = (warehouse: Warehouse) => {
    setEditingWarehouseId(warehouse.id);
    setEditName(warehouse.name);
    setEditUseBins(warehouse.use_bins);
    setEditError(null);
    setEditSuccessId(null);
  };

  const cancelEditing = () => {
    setEditingWarehouseId(null);
    setEditName("");
    setEditUseBins(false);
    setEditError(null);
  };

  const handleUpdate = async (warehouseId: string) => {
    setEditError(null);
    setEditSuccessId(null);

    const trimmedName = editName.trim();

    if (!trimmedName) {
      setEditError("Warehouse name is required");
      return;
    }

    if (trimmedName.length > 100) {
      setEditError("Warehouse name must be 100 characters or less");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: warehouseId,
        data: { name: trimmedName, use_bins: editUseBins },
      });
      setEditingWarehouseId(null);
      setEditName("");
      setEditUseBins(false);
      setEditSuccessId(warehouseId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEditError("A warehouse with this name already exists");
      } else if (err instanceof ApiError && err.status === 403) {
        setEditError("You do not have permission to edit warehouses");
      } else if (err instanceof ApiError && err.status === 404) {
        setEditError("Warehouse not found");
      } else {
        setEditError(getApiErrorMessage(err, "Failed to update warehouse"));
      }
    }
  };

  if (user?.role !== "owner") {
    return (
      <div className="max-w-3xl space-y-4">
        <h2 className="text-2xl font-extrabold text-gray-900">
          Warehouse Configuration
        </h2>
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          Only owners can create or manage warehouses.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            Create a New Warehouse
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Configure a warehouse name and whether it requires bins.
          </p>
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
              disabled={isLoading || warehousesQuery.isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Warehouse"}
            </button>
          </div>
        </form>
      </div>

      <section className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Warehouses</h3>

        {editError && (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {editError}
          </p>
        )}

        {warehousesQuery.isLoading ? (
          <p className="mt-4 text-sm text-gray-600">Loading warehouses...</p>
        ) : warehousesQuery.isError ? (
          <p className="mt-4 text-sm text-red-700">
            Failed to load warehouses.
          </p>
        ) : warehouses.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">No warehouses yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {warehouses.map((warehouse) => (
              <li
                key={warehouse.id}
                className="rounded-md bg-gray-50 px-4 py-3"
              >
                {editingWarehouseId === warehouse.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                      disabled={updateMutation.isPending}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                    <label className="flex items-center text-sm text-gray-900">
                      <input
                        type="checkbox"
                        checked={editUseBins}
                        onChange={(e) => setEditUseBins(e.target.checked)}
                        disabled={updateMutation.isPending}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2">
                        Use bins/shelves for organization
                      </span>
                    </label>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-600">
                        Created{" "}
                        {new Date(warehouse.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={updateMutation.isPending}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(warehouse.id)}
                          disabled={updateMutation.isPending}
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updateMutation.isPending ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {warehouse.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Created{" "}
                        {new Date(warehouse.created_at).toLocaleDateString()}
                      </p>
                      {editSuccessId === warehouse.id && (
                        <p className="mt-1 text-sm text-green-700">
                          Warehouse updated successfully.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700">
                        {warehouse.use_bins ? "Bins enabled" : "No bins"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditing(warehouse)}
                        disabled={updateMutation.isPending}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
