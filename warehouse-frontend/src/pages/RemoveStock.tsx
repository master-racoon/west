import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { useBinsByWarehouse } from "../hooks/queries/useBins";
import {
  useApproveRemovalApproval,
  useInventoryBalance,
  useRejectRemovalApproval,
  useRemoveStock,
  useRemovalApprovals,
} from "../hooks/queries/useInventory";
import { useWarehouses } from "../hooks/queries/useWarehouses";
import { ApiError, client, getApiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

interface ResolvedItem {
  id: string;
  name: string;
}

interface RemoveStockPageProps {
  embedded?: boolean;
}

interface ShortfallWarning {
  warning: string;
  approval_requested: boolean;
  approval_id?: string;
  approval_status?: "pending";
  current_balance: number;
  requested_quantity: number;
  shortfall: number;
}

function isShortfallWarning(value: unknown): value is ShortfallWarning {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.success === false &&
    candidate.owner_approval_required === true &&
    typeof candidate.warning === "string" &&
    typeof candidate.approval_requested === "boolean" &&
    (candidate.approval_id === undefined ||
      typeof candidate.approval_id === "string") &&
    (candidate.approval_status === undefined ||
      candidate.approval_status === "pending") &&
    typeof candidate.current_balance === "number" &&
    typeof candidate.requested_quantity === "number" &&
    typeof candidate.shortfall === "number"
  );
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function getStatusBadgeClass(status: "pending" | "approved" | "rejected") {
  if (status === "approved") {
    return "bg-green-100 text-green-800";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-800";
  }

  return "bg-amber-100 text-amber-900";
}

export function RemoveStockPage({ embedded = false }: RemoveStockPageProps) {
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [barcodeOrItemId, setBarcodeOrItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedBinId, setSelectedBinId] = useState("");
  const [resolvedItem, setResolvedItem] = useState<ResolvedItem | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [isResolvingItem, setIsResolvingItem] = useState(false);
  const [shortfallWarning, setShortfallWarning] =
    useState<ShortfallWarning | null>(null);

  const warehousesQuery = useWarehouses();
  const removeStockMutation = useRemoveStock();
  const removalApprovalsQuery = useRemovalApprovals();
  const approveRemovalApprovalMutation = useApproveRemovalApproval();
  const rejectRemovalApprovalMutation = useRejectRemovalApproval();

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
  const visibleApprovals = removalApprovalsQuery.data || [];
  const pendingApprovals = visibleApprovals.filter(
    (approval) => approval.status === "pending",
  );
  const activeApprovalActionId = approveRemovalApprovalMutation.isPending
    ? approveRemovalApprovalMutation.variables
    : rejectRemovalApprovalMutation.isPending
      ? rejectRemovalApprovalMutation.variables
      : undefined;

  const resetMessages = () => {
    setBarcodeError(null);
    setFormError(null);
    setSuccessMessage(null);
    setApprovalMessage(null);
    setShortfallWarning(null);
  };

  const resolveItem = async () => {
    const value = barcodeOrItemId.trim();

    setBarcodeError(null);
    setFormError(null);
    setSuccessMessage(null);
    setApprovalMessage(null);
    setShortfallWarning(null);

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

  const submitRemoval = async (options?: {
    requestOwnerApproval?: boolean;
  }) => {
    const parsedQuantity = Number(quantity);

    setFormError(null);
    setSuccessMessage(null);
    setApprovalMessage(null);

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
      const result = await removeStockMutation.mutateAsync({
        warehouse_id: selectedWarehouseId,
        item_id: resolvedItem.id,
        quantity: parsedQuantity,
        ...(selectedBinId ? { bin_id: selectedBinId } : {}),
        ...(options?.requestOwnerApproval
          ? { request_owner_approval: true }
          : {}),
      });

      const selectedBin = (binsQuery.data || []).find(
        (bin) => bin.id === selectedBinId,
      );

      setQuantity("1");
      setShortfallWarning(null);
      setSuccessMessage(
        `Removed ${result.quantity_removed} qty of ${resolvedItem.name} from ${selectedWarehouse?.name}${selectedBin ? ` (${selectedBin.name})` : ""}. Balance now ${result.balance_after}.`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const body = error.body;

        if (isShortfallWarning(body)) {
          setShortfallWarning(body);
          if (body.approval_requested) {
            setApprovalMessage(
              isOwner
                ? "Shortfall request is pending. Review it in the approval queue below."
                : "Shortfall request sent to an owner. Track its status below.",
            );
            void removalApprovalsQuery.refetch();
          } else {
            setApprovalMessage(null);
          }
          return;
        }
      }

      setFormError(getApiErrorMessage(error, "Failed to remove stock"));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitRemoval();
  };

  const handleRequestOwnerApproval = async () => {
    await submitRemoval({ requestOwnerApproval: true });
  };

  const handleApprovalDecision = async (
    approvalId: string,
    decision: "approve" | "reject",
  ) => {
    setFormError(null);

    try {
      if (decision === "approve") {
        await approveRemovalApprovalMutation.mutateAsync(approvalId);
        setSuccessMessage("Removal approved and completed.");
      } else {
        await rejectRemovalApprovalMutation.mutateAsync(approvalId);
        setApprovalMessage("Removal request rejected.");
      }
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          decision === "approve"
            ? "Failed to approve removal request"
            : "Failed to reject removal request",
        ),
      );
    }
  };

  return (
    <>
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
              <h1 className="text-3xl font-bold text-gray-900">Remove Stock</h1>
              <p className="mt-2 text-sm text-gray-600">
                Remove inventory from a warehouse with shortfall approval when
                needed.
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

              {approvalMessage && (
                <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
                  {approvalMessage}
                </div>
              )}

              {(formError || barcodeError) && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                  {formError || barcodeError}
                </div>
              )}

              <div>
                <label
                  htmlFor="remove-warehouse-id"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Warehouse
                </label>
                <select
                  id="remove-warehouse-id"
                  value={selectedWarehouseId}
                  onChange={(event) =>
                    handleWarehouseChange(event.target.value)
                  }
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={
                    warehousesQuery.isLoading || removeStockMutation.isPending
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
                    htmlFor="remove-barcode-or-item-id"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Barcode or Item ID
                  </label>
                  <input
                    id="remove-barcode-or-item-id"
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
                    placeholder="Scan barcode or paste item id"
                    disabled={removeStockMutation.isPending}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void resolveItem()}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={removeStockMutation.isPending || isResolvingItem}
                >
                  {isResolvingItem ? "Resolving..." : "Resolve"}
                </button>
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-2">
                <p>
                  {resolvedItem
                    ? `Resolved item: ${resolvedItem.name}`
                    : "Resolve a barcode to confirm the item before removing stock."}
                </p>
                <p>
                  {selectedWarehouse
                    ? `Warehouse: ${selectedWarehouse.name}${selectedWarehouse.use_bins && selectedBinId ? ` / ${binsQuery.data?.find((bin) => bin.id === selectedBinId)?.name || "Selected bin"}` : ""}`
                    : "Choose a warehouse to see availability context."}
                </p>
                <p>
                  {resolvedItem && selectedWarehouseId
                    ? selectedWarehouse?.use_bins && !selectedBinId
                      ? "Select a bin to see current availability for this removal."
                      : balanceQuery.isLoading
                        ? "Checking current availability..."
                        : `Current availability: ${currentBalance}`
                    : "Current availability appears after warehouse and item are selected."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="remove-quantity"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Quantity
                  </label>
                  <input
                    id="remove-quantity"
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={!resolvedItem || removeStockMutation.isPending}
                  />
                </div>

                {selectedWarehouse?.use_bins && (
                  <div>
                    <label
                      htmlFor="remove-bin-id"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Bin
                    </label>
                    <select
                      id="remove-bin-id"
                      value={selectedBinId}
                      onChange={(event) => {
                        setSelectedBinId(event.target.value);
                        resetMessages();
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={
                        binsQuery.isLoading || removeStockMutation.isPending
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
              </div>

              <button
                type="submit"
                className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  removeStockMutation.isPending ||
                  isResolvingItem ||
                  !selectedWarehouseId ||
                  !resolvedItem
                }
              >
                {removeStockMutation.isPending ? "Removing..." : "Remove Stock"}
              </button>
            </form>
          </section>

          <section className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isOwner
                  ? "Pending Shortfall Approvals"
                  : "Your Shortfall Requests"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {isOwner
                  ? "Approve or reject pending removals that would drive stock below zero."
                  : "Review pending, approved, and rejected shortfall requests from this account."}
              </p>
            </div>

            {removalApprovalsQuery.isLoading ? (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Loading approval requests...
              </div>
            ) : removalApprovalsQuery.isError ? (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
                {getApiErrorMessage(
                  removalApprovalsQuery.error,
                  "Failed to load shortfall requests",
                )}
              </div>
            ) : (isOwner ? pendingApprovals : visibleApprovals).length === 0 ? (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {isOwner
                  ? "No pending shortfall approvals right now."
                  : "No shortfall requests yet."}
              </div>
            ) : (
              <div className="space-y-3">
                {(isOwner ? pendingApprovals : visibleApprovals).map(
                  (approval) => {
                    const isActingOnRow =
                      activeApprovalActionId === approval.id;

                    return (
                      <article
                        key={approval.id}
                        className="rounded-lg border border-gray-200 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2 text-sm text-gray-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-medium text-gray-900">
                                {approval.item_name}
                              </h3>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(approval.status)}`}
                              >
                                {approval.status}
                              </span>
                            </div>
                            <p>
                              Warehouse:{" "}
                              <span className="font-medium">
                                {approval.warehouse_name}
                              </span>
                              {approval.bin_name
                                ? ` / ${approval.bin_name}`
                                : ""}
                            </p>
                            <p>
                              Requested:{" "}
                              <span className="font-medium">
                                {approval.quantity_requested}
                              </span>
                              {" · "}
                              Snapshot balance:{" "}
                              <span className="font-medium">
                                {approval.current_balance}
                              </span>
                              {" · "}
                              Shortfall:{" "}
                              <span className="font-medium">
                                {approval.shortfall}
                              </span>
                            </p>
                            <p>
                              Requested by{" "}
                              <span className="font-medium">
                                {approval.requested_by_name}
                              </span>
                              {" · "}
                              Submitted {formatTimestamp(approval.created_at)}
                            </p>
                            {approval.status === "approved" &&
                              approval.decided_at && (
                                <p className="text-green-700">
                                  Approved by{" "}
                                  {approval.approved_by_owner_name || "owner"}{" "}
                                  on {formatTimestamp(approval.decided_at)}.
                                </p>
                              )}
                            {approval.status === "rejected" &&
                              approval.decided_at && (
                                <p className="text-red-700">
                                  Rejected by{" "}
                                  {approval.approved_by_owner_name || "owner"}{" "}
                                  on {formatTimestamp(approval.decided_at)}.
                                </p>
                              )}
                            {approval.status === "pending" && !isOwner && (
                              <p className="text-amber-800">
                                Awaiting owner decision. No stock has been
                                removed yet.
                              </p>
                            )}
                            {approval.status === "approved" &&
                              approval.movement_id &&
                              !isOwner && (
                                <p className="text-green-700">
                                  Approval completed and the stock removal was
                                  posted.
                                </p>
                              )}
                          </div>

                          {isOwner && (
                            <div className="flex flex-col gap-2 md:w-40">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleApprovalDecision(
                                    approval.id,
                                    "approve",
                                  )
                                }
                                className="inline-flex justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={
                                  approveRemovalApprovalMutation.isPending ||
                                  rejectRemovalApprovalMutation.isPending
                                }
                              >
                                {isActingOnRow &&
                                approveRemovalApprovalMutation.isPending
                                  ? "Approving..."
                                  : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleApprovalDecision(
                                    approval.id,
                                    "reject",
                                  )
                                }
                                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={
                                  approveRemovalApprovalMutation.isPending ||
                                  rejectRemovalApprovalMutation.isPending
                                }
                              >
                                {isActingOnRow &&
                                rejectRemovalApprovalMutation.isPending
                                  ? "Rejecting..."
                                  : "Reject"}
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {shortfallWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Insufficient Stock
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Owner approval is required to remove beyond current
                availability.
              </p>
            </div>

            <div className="space-y-3 px-6 py-5 text-sm text-gray-700">
              <p>{shortfallWarning.warning}</p>
              {shortfallWarning.approval_requested &&
              shortfallWarning.approval_id ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  Approval request{" "}
                  <span className="font-medium">
                    {shortfallWarning.approval_id}
                  </span>{" "}
                  is now pending.
                  {isOwner
                    ? " Review it in the pending approvals queue below."
                    : " An owner must approve or reject it before any stock is removed."}
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  No approval request has been created yet. Choose whether to
                  ask an owner for approval or cancel this removal.
                </div>
              )}
              {!isOwner && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  No stock has been removed yet. You can leave this page and
                  come back later to check the request status.
                </div>
              )}
              {shortfallWarning.approval_status && (
                <p>
                  Status:{" "}
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(shortfallWarning.approval_status)}`}
                  >
                    {shortfallWarning.approval_status}
                  </span>
                </p>
              )}
              <p>
                Item: <span className="font-medium">{resolvedItem?.name}</span>
              </p>
              <p>
                Warehouse:{" "}
                <span className="font-medium">{selectedWarehouse?.name}</span>
              </p>
              <p>
                Available:{" "}
                <span className="font-medium">
                  {shortfallWarning.current_balance}
                </span>
              </p>
              <p>
                Requested:{" "}
                <span className="font-medium">
                  {shortfallWarning.requested_quantity}
                </span>
              </p>
              <p>
                Shortfall:{" "}
                <span className="font-medium">
                  {shortfallWarning.shortfall}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              {!shortfallWarning.approval_requested && (
                <button
                  type="button"
                  onClick={() => void handleRequestOwnerApproval()}
                  className="inline-flex justify-center rounded-md border border-transparent bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={removeStockMutation.isPending}
                >
                  {removeStockMutation.isPending
                    ? "Requesting..."
                    : "Request Owner Approval"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShortfallWarning(null)}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={removeStockMutation.isPending}
              >
                {shortfallWarning.approval_requested ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
