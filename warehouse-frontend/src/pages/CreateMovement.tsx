import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { useBinsByWarehouse } from "../hooks/queries/useBins";
import { useCreateManualMovement } from "../hooks/queries/useInventory";
import { useWarehouses } from "../hooks/queries/useWarehouses";
import {
  ApiError,
  getApiErrorMessage,
  resolveItemReference,
  ResolvedItem,
} from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { ScanOverlay } from "../components/ScanOverlay";

export function CreateMovementPage() {
  const { user, userUser } = useAuthStore();
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [barcodeOrItemId, setBarcodeOrItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [selectedBinId, setSelectedBinId] = useState("");
  const [resolvedItem, setResolvedItem] = useState<ResolvedItem | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResolvingItem, setIsResolvingItem] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const warehousesQuery = useWarehouses();
  const createMovementMutation = useCreateManualMovement();

  const selectedWarehouse = useMemo(
    () =>
      (warehousesQuery.data || []).find(
        (warehouse) => warehouse.id === selectedWarehouseId,
      ),
    [selectedWarehouseId, warehousesQuery.data],
  );

  const binsQuery = useBinsByWarehouse(
    selectedWarehouse?.use_bins ? selectedWarehouseId : undefined,
  );

  if (user?.role !== "owner") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="mt-3 text-sm leading-6">
              This page is only accessible to the owner account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Owner must be acting as a personal user when creating manual movements
  if (user?.role === "owner" && !userUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
            <h1 className="text-2xl font-bold">Owner Session Active</h1>
            <p className="mt-3 text-sm leading-6">
              Manual movements must be created while signed in as a personal
              user. Use the Inventory workspace to continue as a user while
              keeping your owner session active.
            </p>
            <div className="mt-4">
              <a
                href="/dashboard/inventory"
                className="inline-flex items-center rounded bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900"
              >
                Continue as User
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resetScanFields = () => {
    setBarcodeOrItemId("");
    setQuantity("");
    setNote("");
    setResolvedItem(null);
    setBarcodeError(null);
    setFormError(null);
    barcodeInputRef.current?.focus();
  };

  const resolveItem = async () => {
    const value = barcodeOrItemId.trim();

    setBarcodeError(null);
    setFormError(null);
    setSuccessMessage(null);

    if (!value) {
      setResolvedItem(null);
      setBarcodeError("Scan a barcode, or enter a SKU");
      return;
    }

    setIsResolvingItem(true);

    try {
      setResolvedItem(await resolveItemReference(value));
    } catch (error) {
      setResolvedItem(null);

      if (error instanceof ApiError && error.status === 404) {
        setBarcodeError("Item not found");
        return;
      }
      setBarcodeError(getApiErrorMessage(error, "Failed to resolve item"));
    } finally {
      setIsResolvingItem(false);
    }
  };

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    setSelectedBinId("");
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleScanResult = (value: string) => {
    setBarcodeOrItemId(value);
    setResolvedItem(null);
    setBarcodeError(null);
    setSuccessMessage(null);
    setShowScanner(false);
    setTimeout(async () => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setIsResolvingItem(true);
      try {
        setResolvedItem(await resolveItemReference(trimmed));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setBarcodeError("Item not found");
        } else {
          setBarcodeError(getApiErrorMessage(error, "Failed to resolve item"));
        }
      } finally {
        setIsResolvingItem(false);
      }
    }, 0);
  };

  const handleBarcodeKeyDown = async (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    await resolveItem();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedQuantity = Number(quantity);
    setFormError(null);
    setSuccessMessage(null);

    if (!selectedWarehouseId) {
      setFormError("Select a warehouse");
      return;
    }

    if (!resolvedItem) {
      setBarcodeError("Resolve an item before submitting");
      return;
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity === 0) {
      setFormError("Quantity must be a non-zero integer");
      return;
    }

    if (selectedWarehouse?.use_bins && !selectedBinId) {
      setFormError("Select a bin for this warehouse");
      return;
    }

    try {
      const result = await createMovementMutation.mutateAsync({
        item_id: resolvedItem.id,
        warehouse_id: selectedWarehouseId,
        quantity: parsedQuantity,
        ...(selectedBinId ? { bin_id: selectedBinId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });

      const selectedBin = (binsQuery.data || []).find(
        (bin) => bin.id === selectedBinId,
      );

      const direction = result.quantity > 0 ? "+" : "";
      setSuccessMessage(
        `Manual adjustment created: ${direction}${result.quantity} qty of ${resolvedItem.name} in ${selectedWarehouse?.name}${selectedBin ? ` (${selectedBin.name})` : ""}`,
      );
      resetScanFields();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Failed to create movement"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Create Manual Movement
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Create a MANUAL_ADJUSTMENT movement directly, bypassing stock
            guards. Positive quantity adds stock; negative quantity removes
            stock.
          </p>
        </div>

        <section className="bg-white rounded-lg shadow p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {successMessage && (
              <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
                {successMessage}
              </div>
            )}

            {(formError || barcodeError) && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                {formError || barcodeError}
              </div>
            )}

            <div>
              <label
                htmlFor="warehouse"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Warehouse
              </label>
              <select
                id="warehouse"
                value={selectedWarehouseId}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={createMovementMutation.isPending}
              >
                <option value="">Select a warehouse</option>
                {(warehousesQuery.data || []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedWarehouse?.use_bins && (
              <div>
                <label
                  htmlFor="bin"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Bin
                </label>
                <select
                  id="bin"
                  value={selectedBinId}
                  onChange={(e) => setSelectedBinId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={createMovementMutation.isPending}
                >
                  <option value="">Select a bin</option>
                  {(binsQuery.data || []).map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="item"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Item
              </label>
              <div className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  id="item"
                  type="text"
                  value={barcodeOrItemId}
                  onChange={(e) => {
                    setBarcodeOrItemId(e.target.value);
                    setResolvedItem(null);
                    setBarcodeError(null);
                  }}
                  onBlur={() => {
                    if (barcodeOrItemId.trim()) {
                      void resolveItem();
                    }
                  }}
                  onKeyDown={handleBarcodeKeyDown}
                  autoFocus
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Scan a barcode, or enter a SKU"
                  disabled={createMovementMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createMovementMutation.isPending}
                >
                  📷 Scan
                </button>
                <button
                  type="button"
                  onClick={() => void resolveItem()}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createMovementMutation.isPending || isResolvingItem}
                >
                  {isResolvingItem ? "Resolving..." : "Resolve"}
                </button>
              </div>

              <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {resolvedItem
                  ? `Resolved item: ${resolvedItem.name}${resolvedItem.sku ? ` (SKU: ${resolvedItem.sku})` : ""}`
                  : "Scan a barcode, or enter a SKU"}
              </div>
            </div>

            <div>
              <label
                htmlFor="quantity"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Quantity{" "}
                <span className="text-gray-500 font-normal">
                  (positive = stock in, negative = stock out)
                </span>
              </label>
              <input
                id="quantity"
                type="number"
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g. 10 or -5"
                disabled={createMovementMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="note"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Note{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Reason for adjustment, e.g. write-off, opening balance correction"
                disabled={createMovementMutation.isPending}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={createMovementMutation.isPending}
              >
                {createMovementMutation.isPending
                  ? "Creating..."
                  : "Create Movement"}
              </button>
            </div>
          </form>
        </section>

        {showScanner && (
          <ScanOverlay
            onBarcodeScan={handleScanResult}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
    </div>
  );
}
