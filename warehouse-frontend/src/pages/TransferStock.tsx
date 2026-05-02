import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { useBinsByWarehouse } from "../hooks/queries/useBins";
import {
  useInventoryBalance,
  useTransferStock,
} from "../hooks/queries/useInventory";
import { useWarehouses } from "../hooks/queries/useWarehouses";
import { ApiError, getApiErrorMessage, resolveItemReference } from "../lib/api";
import { ScanOverlay } from "../components/ScanOverlay";

interface ResolvedItem {
  id: string;
  name: string;
  sku?: string;
}

interface TransferStockPageProps {
  embedded?: boolean;
}

export function TransferStockPage({
  embedded = false,
}: TransferStockPageProps) {
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [barcodeOrItemId, setBarcodeOrItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sourceBinId, setSourceBinId] = useState("");
  const [destBinId, setDestBinId] = useState("");
  const [resolvedItem, setResolvedItem] = useState<ResolvedItem | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResolvingItem, setIsResolvingItem] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const warehousesQuery = useWarehouses();
  const transferStockMutation = useTransferStock();

  const sourceWarehouse = useMemo(
    () =>
      (warehousesQuery.data || []).find(
        (warehouse) => warehouse.id === sourceWarehouseId,
      ),
    [sourceWarehouseId, warehousesQuery.data],
  );

  const destWarehouse = useMemo(
    () =>
      (warehousesQuery.data || []).find(
        (warehouse) => warehouse.id === destWarehouseId,
      ),
    [destWarehouseId, warehousesQuery.data],
  );

  const sourceBinsQuery = useBinsByWarehouse(
    sourceWarehouse?.use_bins ? sourceWarehouseId : undefined,
  );
  const destBinsQuery = useBinsByWarehouse(
    destWarehouse?.use_bins ? destWarehouseId : undefined,
  );

  const sourceBalanceFilters =
    sourceWarehouseId &&
    resolvedItem &&
    (!sourceWarehouse?.use_bins || Boolean(sourceBinId))
      ? {
          warehouse_id: sourceWarehouseId,
          item_id: resolvedItem.id,
          ...(sourceWarehouse?.use_bins && sourceBinId
            ? { bin_id: sourceBinId }
            : {}),
        }
      : undefined;

  const sourceBalanceQuery = useInventoryBalance(sourceBalanceFilters);
  const sourceBalance = sourceBalanceQuery.data?.[0]?.quantity ?? 0;
  const isCheckingSourceAvailability =
    Boolean(sourceBalanceFilters) &&
    (sourceBalanceQuery.isLoading || sourceBalanceQuery.isFetching);

  const resetMessages = () => {
    setBarcodeError(null);
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleScanResult = (value: string) => {
    setBarcodeOrItemId(value);
    setResolvedItem(null);
    resetMessages();
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

  const resetForm = () => {
    setSourceWarehouseId("");
    setDestWarehouseId("");
    setBarcodeOrItemId("");
    setQuantity("1");
    setSourceBinId("");
    setDestBinId("");
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
      setBarcodeError("Scan or enter a barcode, SKU, or item ID");
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

  const handleSourceWarehouseChange = (warehouseId: string) => {
    setSourceWarehouseId(warehouseId);
    setSourceBinId("");
    if (warehouseId === destWarehouseId) {
      setDestWarehouseId("");
      setDestBinId("");
    }
    resetMessages();
  };

  const handleDestWarehouseChange = (warehouseId: string) => {
    setDestWarehouseId(warehouseId);
    setDestBinId("");
    resetMessages();
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

    if (!resolvedItem) {
      setBarcodeError("Resolve an item before submitting");
      return;
    }

    if (!sourceWarehouseId) {
      setFormError("Select a source warehouse");
      return;
    }

    if (!destWarehouseId) {
      setFormError("Select a destination warehouse");
      return;
    }

    if (sourceWarehouseId === destWarehouseId) {
      setFormError("Source and destination warehouses must be different");
      return;
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setFormError("Quantity must be greater than 0");
      return;
    }

    if (sourceWarehouse?.use_bins && !sourceBinId) {
      setFormError("Select a source bin for this warehouse");
      return;
    }

    if (destWarehouse?.use_bins && !destBinId) {
      setFormError("Select a destination bin for this warehouse");
      return;
    }

    if (isCheckingSourceAvailability) {
      setFormError("Checking source availability. Try again in a moment.");
      return;
    }

    if (
      resolvedItem &&
      sourceWarehouseId &&
      (!sourceWarehouse?.use_bins || sourceBinId) &&
      parsedQuantity > sourceBalance
    ) {
      setFormError(
        `Only ${sourceBalance} available in the selected source location`,
      );
      return;
    }

    try {
      const result = await transferStockMutation.mutateAsync({
        item_id: resolvedItem.id,
        quantity: parsedQuantity,
        source_warehouse_id: sourceWarehouseId,
        dest_warehouse_id: destWarehouseId,
        ...(sourceBinId ? { source_bin_id: sourceBinId } : {}),
        ...(destBinId ? { dest_bin_id: destBinId } : {}),
      });

      const sourceBin = (sourceBinsQuery.data || []).find(
        (bin) => bin.id === sourceBinId,
      );
      const destBin = (destBinsQuery.data || []).find(
        (bin) => bin.id === destBinId,
      );

      setSuccessMessage(
        `Transferred ${result.quantity} of ${resolvedItem.name} from ${sourceWarehouse?.name}${sourceBin ? ` (${sourceBin.name})` : ""} to ${destWarehouse?.name}${destBin ? ` (${destBin.name})` : ""}.`,
      );
      resetForm();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Failed to transfer stock"));
    }
  };

  const destinationWarehouses = (warehousesQuery.data || []).filter(
    (warehouse) => warehouse.id !== sourceWarehouseId,
  );

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
            <h1 className="text-3xl font-bold text-gray-900">Transfer Stock</h1>
            <p className="mt-2 text-sm text-gray-600">
              Move inventory between warehouses with optional bin selection on
              each side.
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

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label
                  htmlFor="transfer-barcode-or-item-id"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Barcode, SKU, or Item ID
                </label>
                <input
                  id="transfer-barcode-or-item-id"
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeOrItemId}
                  onChange={(event) => {
                    setBarcodeOrItemId(event.target.value);
                    setResolvedItem(null);
                    resetMessages();
                  }}
                  onBlur={() => {
                    if (barcodeOrItemId.trim()) {
                      void resolveItem();
                    }
                  }}
                  onKeyDown={handleBarcodeKeyDown}
                  autoFocus
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Scan barcode or enter SKU or item ID"
                  disabled={transferStockMutation.isPending}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={transferStockMutation.isPending}
              >
                📷 Scan
              </button>
              <button
                type="button"
                onClick={() => void resolveItem()}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={transferStockMutation.isPending || isResolvingItem}
              >
                {isResolvingItem ? "Resolving..." : "Resolve"}
              </button>
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-2">
              <p>
                {resolvedItem
                  ? `Resolved item: ${resolvedItem.name}${resolvedItem.sku ? ` (SKU: ${resolvedItem.sku})` : ""}`
                  : "Resolve a barcode, SKU, or item ID before transferring stock."}
              </p>
              <p>
                {sourceWarehouse
                  ? `Source: ${sourceWarehouse.name}${sourceWarehouse.use_bins && sourceBinId ? ` / ${sourceBinsQuery.data?.find((bin) => bin.id === sourceBinId)?.name || "Selected bin"}` : ""}`
                  : "Choose a source warehouse to see current availability."}
              </p>
              <p>
                {resolvedItem && sourceWarehouseId
                  ? sourceWarehouse?.use_bins && !sourceBinId
                    ? "Select a source bin to see current availability for this transfer."
                    : isCheckingSourceAvailability
                      ? "Checking source availability..."
                      : `Source availability: ${sourceBalance}`
                  : "Source availability appears after source warehouse and item are selected."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <h2 className="text-base font-semibold text-gray-900">
                  Source
                </h2>

                <div>
                  <label
                    htmlFor="transfer-source-warehouse-id"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Warehouse
                  </label>
                  <select
                    id="transfer-source-warehouse-id"
                    value={sourceWarehouseId}
                    onChange={(event) =>
                      handleSourceWarehouseChange(event.target.value)
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={
                      warehousesQuery.isLoading ||
                      transferStockMutation.isPending
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

                {sourceWarehouse?.use_bins && (
                  <div>
                    <label
                      htmlFor="transfer-source-bin-id"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Bin
                    </label>
                    <select
                      id="transfer-source-bin-id"
                      value={sourceBinId}
                      onChange={(event) => {
                        setSourceBinId(event.target.value);
                        resetMessages();
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={
                        sourceBinsQuery.isLoading ||
                        transferStockMutation.isPending
                      }
                    >
                      <option value="">Select a bin</option>
                      {(sourceBinsQuery.data || []).map((bin) => (
                        <option key={bin.id} value={bin.id}>
                          {bin.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center py-2 text-2xl font-semibold text-gray-400">
                <span aria-hidden="true">→</span>
              </div>

              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <h2 className="text-base font-semibold text-gray-900">
                  Destination
                </h2>

                <div>
                  <label
                    htmlFor="transfer-dest-warehouse-id"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Warehouse
                  </label>
                  <select
                    id="transfer-dest-warehouse-id"
                    value={destWarehouseId}
                    onChange={(event) =>
                      handleDestWarehouseChange(event.target.value)
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={
                      warehousesQuery.isLoading ||
                      transferStockMutation.isPending
                    }
                  >
                    <option value="">Select a warehouse</option>
                    {destinationWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                        {warehouse.use_bins ? " (bins enabled)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {destWarehouse?.use_bins && (
                  <div>
                    <label
                      htmlFor="transfer-dest-bin-id"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Bin
                    </label>
                    <select
                      id="transfer-dest-bin-id"
                      value={destBinId}
                      onChange={(event) => {
                        setDestBinId(event.target.value);
                        resetMessages();
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={
                        destBinsQuery.isLoading ||
                        transferStockMutation.isPending
                      }
                    >
                      <option value="">Select a bin</option>
                      {(destBinsQuery.data || []).map((bin) => (
                        <option key={bin.id} value={bin.id}>
                          {bin.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="transfer-quantity"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Quantity
                </label>
                <input
                  id="transfer-quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    resetMessages();
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={!resolvedItem || transferStockMutation.isPending}
                />
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                transferStockMutation.isPending ||
                isResolvingItem ||
                isCheckingSourceAvailability ||
                !resolvedItem ||
                !sourceWarehouseId ||
                !destWarehouseId
              }
            >
              {transferStockMutation.isPending
                ? "Transferring..."
                : "Transfer Stock"}
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
