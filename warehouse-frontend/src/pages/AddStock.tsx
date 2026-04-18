import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { useBinsByWarehouse } from "../hooks/queries/useBins";
import { useAddStock } from "../hooks/queries/useInventory";
import { useWarehouses } from "../hooks/queries/useWarehouses";
import { ApiError, client, getApiErrorMessage } from "../lib/api";
import { ScanOverlay } from "../components/ScanOverlay";

interface ResolvedItem {
  id: string;
  name: string;
}

interface AddStockPageProps {
  embedded?: boolean;
}

export function AddStockPage({ embedded = false }: AddStockPageProps) {
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [barcodeOrItemId, setBarcodeOrItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedBinId, setSelectedBinId] = useState("");
  const [resolvedItem, setResolvedItem] = useState<ResolvedItem | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResolvingItem, setIsResolvingItem] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const warehousesQuery = useWarehouses();
  const addStockMutation = useAddStock();

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

  const resetScanFields = () => {
    setBarcodeOrItemId("");
    setQuantity("1");
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
      setBarcodeError("Scan or enter a barcode");
      return;
    }

    setIsResolvingItem(true);

    try {
      const barcodeResult = await client.barcodes.lookupItemByBarcode(value);
      setResolvedItem({
        id: barcodeResult.item_id,
        name: barcodeResult.item_name,
      });
      return;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        setResolvedItem(null);
        setBarcodeError(getApiErrorMessage(error, "Failed to resolve item"));
        return;
      }
    } finally {
      setIsResolvingItem(false);
    }

    setIsResolvingItem(true);

    try {
      const itemResult = await client.items.getItem(value);
      setResolvedItem({
        id: itemResult.id,
        name: itemResult.name,
      });
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
    // Auto-resolve after setting the value
    setTimeout(async () => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setIsResolvingItem(true);
      try {
        const barcodeResult =
          await client.barcodes.lookupItemByBarcode(trimmed);
        setResolvedItem({
          id: barcodeResult.item_id,
          name: barcodeResult.item_name,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          try {
            const itemResult = await client.items.getItem(trimmed);
            setResolvedItem({ id: itemResult.id, name: itemResult.name });
          } catch {
            setBarcodeError("Item not found");
          }
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

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setFormError("Quantity must be greater than 0");
      return;
    }

    if (selectedWarehouse?.use_bins && !selectedBinId) {
      setFormError("Select a bin for this warehouse");
      return;
    }

    try {
      const result = await addStockMutation.mutateAsync({
        warehouse_id: selectedWarehouseId,
        barcode_or_item_id: barcodeOrItemId.trim(),
        quantity: parsedQuantity,
        ...(selectedBinId ? { bin_id: selectedBinId } : {}),
      });

      const selectedBin = (binsQuery.data || []).find(
        (bin) => bin.id === selectedBinId,
      );

      setSuccessMessage(
        `Added ${result.quantity} qty of ${resolvedItem.name} to ${selectedWarehouse?.name}${selectedBin ? ` (${selectedBin.name})` : ""}`,
      );
      resetScanFields();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Failed to add stock"));
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-gray-50"}>
      <div
        className={
          embedded
            ? "space-y-6"
            : "max-w-4xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8"
        }
      >
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add Stock</h1>
            <p className="mt-2 text-sm text-gray-600">
              Receive inventory into a warehouse with a scan-first workflow.
            </p>
          </div>
        )}

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
                htmlFor="warehouse-id"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Warehouse
              </label>
              <select
                id="warehouse-id"
                value={selectedWarehouseId}
                onChange={(event) => handleWarehouseChange(event.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={
                  warehousesQuery.isLoading || addStockMutation.isPending
                }
              >
                <option value="">Select a warehouse</option>
                {(warehousesQuery.data || []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                    {warehouse.use_bins ? " (bins enabled)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label
                  htmlFor="barcode-or-item-id"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Barcode or Item ID
                </label>
                <input
                  id="barcode-or-item-id"
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeOrItemId}
                  onChange={(event) => {
                    setBarcodeOrItemId(event.target.value);
                    setResolvedItem(null);
                    setBarcodeError(null);
                    setSuccessMessage(null);
                  }}
                  onBlur={() => {
                    if (barcodeOrItemId.trim()) {
                      void resolveItem();
                    }
                  }}
                  onKeyDown={handleBarcodeKeyDown}
                  autoFocus
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Scan barcode or paste item id"
                  disabled={addStockMutation.isPending}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={addStockMutation.isPending}
              >
                📷 Scan
              </button>
              <button
                type="button"
                onClick={() => void resolveItem()}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={addStockMutation.isPending || isResolvingItem}
              >
                {isResolvingItem ? "Resolving..." : "Resolve"}
              </button>
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {resolvedItem
                ? `Resolved item: ${resolvedItem.name}`
                : "Resolve a barcode to confirm the item before adding stock."}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="quantity"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={!resolvedItem || addStockMutation.isPending}
                />
              </div>

              {selectedWarehouse?.use_bins && (
                <div>
                  <label
                    htmlFor="bin-id"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Bin
                  </label>
                  <select
                    id="bin-id"
                    value={selectedBinId}
                    onChange={(event) => setSelectedBinId(event.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={binsQuery.isLoading || addStockMutation.isPending}
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
            </div>

            <button
              type="submit"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                addStockMutation.isPending ||
                isResolvingItem ||
                !selectedWarehouseId ||
                !resolvedItem
              }
            >
              {addStockMutation.isPending ? "Adding..." : "Add Stock"}
            </button>
          </form>
        </section>
      </div>
      {showScanner && (
        <ScanOverlay
          enableOcr
          onBarcodeScan={handleScanResult}
          onTextCapture={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
