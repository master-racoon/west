import { ApiError, WarehouseClient } from "../generated-api";
import { useAuthStore } from "../stores/authStore";

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const bodyError =
      typeof error.body === "object" &&
      error.body !== null &&
      "error" in error.body &&
      typeof error.body.error === "string"
        ? error.body.error
        : null;

    return bodyError || error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function handleUnauthorized(error: unknown): never {
  if (error instanceof ApiError && error.status === 401) {
    localStorage.removeItem("session_token");
    useAuthStore.getState().clearUser();
    window.location.replace("/login");
  }

  throw error;
}

async function withAuthHandling<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    handleUnauthorized(error);
  }
}

async function getAuthHeaders() {
  const token = localStorage.getItem("session_token");
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

const apiClient = new WarehouseClient({
  BASE: "",
  WITH_CREDENTIALS: true,
  CREDENTIALS: "include",
  HEADERS: getAuthHeaders,
});

export const client = {
  warehouses: {
    getWarehouses: () => withAuthHandling(apiClient.warehouses.getWarehouses()),
    createWarehouse: (data: { name: string; use_bins: boolean }) =>
      withAuthHandling(
        apiClient.warehouses.createWarehouse({ requestBody: data }),
      ),
    updateWarehouse: (id: string, data: { name: string; use_bins: boolean }) =>
      withAuthHandling(
        apiClient.warehouses.updateWarehouse({ id, requestBody: data }),
      ),
  },
  bins: {
    createBin: (data: { warehouse_id: string; name: string }) =>
      withAuthHandling(apiClient.bins.createBin({ requestBody: data })),
    getBins: ({ warehouseId }: { warehouseId: string }) =>
      withAuthHandling(apiClient.bins.getBinsByWarehouse({ warehouseId })),
    getBin: (binId: string) =>
      withAuthHandling(apiClient.bins.getBin({ id: binId })),
    renameBin: (id: string, name: string) =>
      withAuthHandling(apiClient.bins.updateBin({ id, requestBody: { name } })),
  },
  inventory: {
    addStock: (data: {
      warehouse_id: string;
      barcode_or_item_id: string;
      quantity: number;
      bin_id?: string;
    }) => withAuthHandling(apiClient.inventory.addStock({ requestBody: data })),
    countAdjust: (data: {
      warehouse_id: string;
      item_id: string;
      observed_quantity: number;
      bin_id?: string;
    }) =>
      withAuthHandling(apiClient.inventory.countAdjust({ requestBody: data })),
    removeStock: (data: {
      warehouse_id: string;
      item_id: string;
      quantity: number;
      bin_id?: string;
      owner_override?: boolean;
      request_owner_approval?: boolean;
    }) =>
      withAuthHandling(
        apiClient.inventory.removeStock({ requestBody: data as any }),
      ),
    transferStock: (data: {
      item_id: string;
      quantity: number;
      source_warehouse_id: string;
      dest_warehouse_id: string;
      source_bin_id?: string;
      dest_bin_id?: string;
    }) =>
      withAuthHandling(
        apiClient.inventory.transferStock({ requestBody: data }),
      ),
    getBalance: (filters?: {
      warehouse_id?: string;
      bin_id?: string;
      item_id?: string;
    }) =>
      withAuthHandling(
        apiClient.inventory.getInventoryBalance({
          warehouseId: filters?.warehouse_id,
          binId: filters?.bin_id,
          itemId: filters?.item_id,
        }),
      ),
    getRemovalApprovals: () =>
      withAuthHandling(apiClient.inventory.getRemovalApprovals()),
    approveRemovalApproval: (approvalId: string) =>
      withAuthHandling(
        apiClient.inventory.approveRemovalApproval({ id: approvalId }),
      ),
    rejectRemovalApproval: (approvalId: string) =>
      withAuthHandling(
        apiClient.inventory.rejectRemovalApproval({ id: approvalId }),
      ),
  },
  items: {
    getItems: () => withAuthHandling(apiClient.items.getItems()),
    getItem: (itemId: string) =>
      withAuthHandling(apiClient.items.getItem({ id: itemId })),
    createItem: (data: {
      name: string;
      description?: string;
      barcodes?: string[];
    }) => withAuthHandling(apiClient.items.createItem({ requestBody: data })),
    addBarcode: (itemId: string, data: { barcode: string }) =>
      withAuthHandling(
        apiClient.items.addBarcode({ id: itemId, requestBody: data }),
      ),
    searchItems: (q: string) =>
      withAuthHandling(apiClient.items.searchItems({ q })),
  },
  barcodes: {
    lookupItemByBarcode: (barcode: string) =>
      withAuthHandling(apiClient.barcodes.lookupItemByBarcode({ barcode })),
  },
};

export { ApiError };
