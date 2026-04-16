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

const apiClient = new WarehouseClient({
  BASE: "",
  WITH_CREDENTIALS: true,
  CREDENTIALS: "include",
  HEADERS: async () => {
    const token = localStorage.getItem("session_token");
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  },
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
  },
  inventory: {
    addStock: (data: {
      warehouse_id: string;
      barcode_or_item_id: string;
      quantity: number;
      bin_id?: string;
    }) => withAuthHandling(apiClient.inventory.addStock({ requestBody: data })),
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
  },
  barcodes: {
    lookupItemByBarcode: (barcode: string) =>
      withAuthHandling(apiClient.barcodes.lookupItemByBarcode({ barcode })),
  },
};

export { ApiError };
