import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBinsByWarehouse } from "../hooks/queries/useBins";
import { useItems } from "../hooks/queries/useItems";
import {
  useCountAdjust,
  useInventoryBalance,
} from "../hooks/queries/useInventory";
import { useWarehouses } from "../hooks/queries/useWarehouses";
import { ApiError, client, getApiErrorMessage } from "../lib/api";

interface ResolvedItem {
  id: string;
  name: string;
}

interface QuickCountPageProps {
  embedded?: boolean;
}

interface CountResultSummary {
  movement_id: string;
  item_id: string;
  item_name: string;
  warehouse_name: string;
  bin_name?: string;
  previous_balance: number;
  new_balance: number;
  delta: number;
}

function getDeltaSummary(delta: number) {
  if (delta > 0) {
    return `Found ${delta} extra ${delta === 1 ? "item" : "items"}.`;
  }

  if (delta < 0) {
    const missing = Math.abs(delta);
    return `Missing ${missing} ${missing === 1 ? "item" : "items"}.`;
  }

  return "Inventory matches. No quantity change was needed.";
}

function getResultCardClass(delta: number) {
  if (delta > 0) {
    return "border-green-200 bg-green-50 text-green-900";
  }

  if (delta < 0) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-blue-200 bg-blue-50 text-blue-900";
}

export function QuickCountPage({ embedded = false }: QuickCountPageProps) {
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedBinId, setSelectedBinId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [barcodeOrItemId, setBarcodeOrItemId] = useState("");
  const [observedQuantity, setObservedQuantity] = useState("");
  const [resolvedItem, setResolvedItem] = useState<ResolvedItem | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isResolvingItem, setIsResolvingItem] = useState(false);
  const [resultSummary, setResultSummary] = useState<CountResultSummary | null>(
    null,
  );

  const warehousesQuery = useWarehouses();
  const itemsQuery = useItems();
  const countAdjustMutation = useCountAdjust();

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

  const balanceFilters =
    selectedWarehouseId &&
    resolvedItem &&
    (!selectedWarehouse?.use_bins || Boolean(selectedBinId))
      ? {
          warehouse_id: selectedWarehouseId,
          item_id: resolvedItem.id,
          ...(selectedWarehouse?.use_bins && selectedBinId
            ? { bin_id: selectedBinId }
            : {}),
        }
      : undefined;

  const balanceQuery = useInventoryBalance(balanceFilters);
  const currentBalance = balanceQuery.data?.[0]?.quantity ?? 0;
  const isCheckingBalance =
    Boolean(balanceFilters) &&
    (balanceQuery.isLoading || balanceQuery.isFetching);

  const parsedObservedQuantity = Number(observedQuantity);
  const hasValidObservedQuantity =
    observedQuantity !== "" &&
    Number.isInteger(parsedObservedQuantity) &&
    parsedObservedQuantity >= 0;
  const deltaPreview =
    hasValidObservedQuantity &&
    resolvedItem &&
    selectedWarehouseId &&
    (!selectedWarehouse?.use_bins || selectedBinId) &&
    !isCheckingBalance
      ? parsedObservedQuantity - currentBalance
      : null;

  useEffect(() => {
    if (!errorToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorToast(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [errorToast]);

  const showBarcodeError = (message: string) => {
    setBarcodeError(message);
    setErrorToast(message);
  };

  const showFormError = (message: string) => {
    setFormError(message);
    setErrorToast(message);
  };

  const resetMessages = () => {
    setBarcodeError(null);
    setFormError(null);
    setErrorToast(null);
  };

  const resolveItem = async () => {
    const value = barcodeOrItemId.trim();

    setBarcodeError(null);
    setFormError(null);

    if (!value) {
      setResolvedItem(null);
      setSelectedItemId("");
      showBarcodeError("Scan or select an item");
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
        setSelectedItemId("");
        showBarcodeError(getApiErrorMessage(error, "Failed to resolve item"));
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
      setSelectedItemId(itemResult.id);
    } catch (error) {
      setResolvedItem(null);
      setSelectedItemId("");

      if (error instanceof ApiError && error.status === 404) {
        showBarcodeError("Item not found");
        return;
      }

      showBarcodeError(getApiErrorMessage(error, "Failed to resolve item"));
    } finally {
      setIsResolvingItem(false);
    }
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    setResultSummary(null);
    resetMessages();

    if (!itemId) {
      setResolvedItem(null);
      return;
    }

    const selectedItem = (itemsQuery.data || []).find(
      (item) => item.id === itemId,
    );

    if (!selectedItem) {
      setResolvedItem(null);
      showBarcodeError("Selected item could not be loaded");
      return;
    }

    setBarcodeOrItemId(selectedItem.id);
    setResolvedItem({
      id: selectedItem.id,
      name: selectedItem.name,
    });
  };

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    setSelectedBinId("");
    setResultSummary(null);
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

    setFormError(null);

    if (!selectedWarehouseId) {
      showFormError("Select a warehouse");
      return;
    }

    if (!resolvedItem) {
      showBarcodeError("Resolve or select an item before submitting");
      return;
    }

    if (!hasValidObservedQuantity) {
      showFormError("Observed quantity must be 0 or greater");
      return;
    }

    if (selectedWarehouse?.use_bins && !selectedBinId) {
      showFormError("Select a bin for this warehouse");
      return;
    }

    if (isCheckingBalance) {
      showFormError("Checking recorded balance. Try again in a moment.");
      return;
    }

    try {
      const result = await countAdjustMutation.mutateAsync({
        warehouse_id: selectedWarehouseId,
        item_id: resolvedItem.id,
        observed_quantity: parsedObservedQuantity,
        ...(selectedBinId ? { bin_id: selectedBinId } : {}),
      });

      const selectedBin = (binsQuery.data || []).find(
        (bin) => bin.id === selectedBinId,
      );

      setResultSummary({
        movement_id: result.movement_id,
        item_id: result.item_id,
        item_name: resolvedItem.name,
        warehouse_name: selectedWarehouse?.name || "Selected warehouse",
        ...(selectedBin ? { bin_name: selectedBin.name } : {}),
        previous_balance: result.previous_balance,
        new_balance: result.new_balance,
        delta: result.delta,
      });
      setBarcodeOrItemId("");
      setObservedQuantity("");
      setResolvedItem(null);
      setSelectedItemId("");
      setBarcodeError(null);
      barcodeInputRef.current?.focus();
    } catch (error) {
      showFormError(getApiErrorMessage(error, "Failed to record quick count"));
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-gray-50"}>
      {errorToast && (
        <div className="pointer-events-none fixed right-4 top-4 z-50">
          <div className="max-w-sm rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">
            {errorToast}
          </div>
        </div>
      )}
      <div
        className={
          embedded
            ? "space-y-6"
            : "max-w-4xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8"
        }
      >
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quick Count</h1>
            <p className="mt-2 text-sm text-gray-600">
              Reconcile recorded stock to what you physically count on hand.
            </p>
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {resultSummary && (
              <div
                className={`rounded-lg border px-4 py-4 text-sm ${getResultCardClass(resultSummary.delta)}`}
              >
                <p className="font-semibold text-base">Quick count recorded</p>
                <p className="mt-1">
                  {resultSummary.item_name} in {resultSummary.warehouse_name}
                  {resultSummary.bin_name ? ` / ${resultSummary.bin_name}` : ""}
                </p>
                <p className="mt-1">
                  Was {resultSummary.previous_balance}, now{" "}
                  {resultSummary.new_balance}, delta{" "}
                  {resultSummary.delta >= 0
                    ? `+${resultSummary.delta}`
                    : resultSummary.delta}
                </p>
                <p className="mt-1">{getDeltaSummary(resultSummary.delta)}</p>
              </div>
            )}

            {(formError || barcodeError) && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                {formError || barcodeError}
              </div>
            )}

            <div>
              <label
                htmlFor="quick-count-warehouse-id"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Warehouse
              </label>
              <select
                id="quick-count-warehouse-id"
                value={selectedWarehouseId}
                onChange={(event) => handleWarehouseChange(event.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={
                  warehousesQuery.isLoading || countAdjustMutation.isPending
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

            {selectedWarehouse?.use_bins && (
              <div>
                <label
                  htmlFor="quick-count-bin-id"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Bin
                </label>
                <select
                  id="quick-count-bin-id"
                  value={selectedBinId}
                  onChange={(event) => {
                    setSelectedBinId(event.target.value);
                    setResultSummary(null);
                    resetMessages();
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={
                    binsQuery.isLoading || countAdjustMutation.isPending
                  }
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

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label
                  htmlFor="quick-count-barcode-or-item-id"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Barcode or Item ID
                </label>
                <input
                  id="quick-count-barcode-or-item-id"
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeOrItemId}
                  onChange={(event) => {
                    setBarcodeOrItemId(event.target.value);
                    setSelectedItemId("");
                    setResolvedItem(null);
                    setResultSummary(null);
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
                  placeholder="Scan barcode or paste item id"
                  disabled={countAdjustMutation.isPending}
                />
              </div>
              <button
                type="button"
                onClick={() => void resolveItem()}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={countAdjustMutation.isPending || isResolvingItem}
              >
                {isResolvingItem ? "Resolving..." : "Resolve"}
              </button>
            </div>

            <div>
              <label
                htmlFor="quick-count-item-id"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Item Selector
              </label>
              <select
                id="quick-count-item-id"
                value={selectedItemId}
                onChange={(event) => handleItemSelect(event.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={itemsQuery.isLoading || countAdjustMutation.isPending}
              >
                <option value="">Select an item if you are not scanning</option>
                {(itemsQuery.data || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.barcodes[0] ? ` (${item.barcodes[0]})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-2">
              <p>
                {resolvedItem
                  ? `Resolved item: ${resolvedItem.name}`
                  : "Resolve a barcode or pick an item before recording a count."}
              </p>
              <p>
                {selectedWarehouse
                  ? `Location: ${selectedWarehouse.name}${selectedWarehouse.use_bins && selectedBinId ? ` / ${binsQuery.data?.find((bin) => bin.id === selectedBinId)?.name || "Selected bin"}` : ""}`
                  : "Choose a warehouse to load the recorded balance context."}
              </p>
              <p>
                {resolvedItem && selectedWarehouseId
                  ? selectedWarehouse?.use_bins && !selectedBinId
                    ? "Select a bin to see the recorded balance for this count."
                    : isCheckingBalance
                      ? "Checking recorded balance..."
                      : `Recorded balance: ${currentBalance}`
                  : "Recorded balance appears after warehouse and item are selected."}
              </p>
              <p>
                {deltaPreview === null
                  ? "Enter the observed quantity to preview the reconciliation delta."
                  : `If submitted now: ${getDeltaSummary(deltaPreview)}`}
              </p>
            </div>

            <div>
              <label
                htmlFor="quick-count-observed-quantity"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Observed Quantity
              </label>
              <input
                id="quick-count-observed-quantity"
                type="number"
                min={0}
                step={1}
                value={observedQuantity}
                onChange={(event) => {
                  setObservedQuantity(event.target.value);
                  resetMessages();
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="0"
                disabled={!resolvedItem || countAdjustMutation.isPending}
              />
            </div>

            <button
              type="submit"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                countAdjustMutation.isPending ||
                isResolvingItem ||
                isCheckingBalance ||
                !selectedWarehouseId ||
                !resolvedItem
              }
            >
              {countAdjustMutation.isPending
                ? "Recording..."
                : "Record Quick Count"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
