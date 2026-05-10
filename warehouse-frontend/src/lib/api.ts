import { toast } from "sonner";
import { ApiError, WarehouseClient } from "../generated-api";
import { useAuthStore } from "../stores/authStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

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
    // On 401, verify the session is actually expired before clearing auth
    // This prevents clearing on transient failures
    localStorage.removeItem("session_token");
    useAuthStore.getState().clearUser();
    window.location.replace("/login");
  }

  throw error;
}

async function withAuthHandling<T>(request: Promise<T>): Promise<T> {
  try {
    const result = await request;
    toast.success("Success");
    return result;
  } catch (error) {
    toast.error(getApiErrorMessage(error, "Request failed"));
    // On 401, first validate that session is actually expired
    if (error instanceof ApiError && error.status === 401) {
      try {
        const token = localStorage.getItem("session_token");
        const response = await fetch(
          `${import.meta.env.VITE_API_URL ?? ""}/api/auth/session`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );

        // If session endpoint also returns 401, user is definitely unauthenticated
        if (!response.ok) {
          handleUnauthorized(error);
        }
        // If session endpoint returns 2xx, session is still valid
        // So the 401 was likely a transient error - rethrow to let React Query retry
        throw error;
      } catch (sessionError) {
        // If we can't verify the session, assume it's expired
        if (sessionError instanceof ApiError && sessionError.status === 401) {
          handleUnauthorized(error);
        }
        // For other errors (network), just rethrow the original 401
        throw error;
      }
    }

    throw error;
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

async function getInventoryAuthHeaders() {
  const userToken = localStorage.getItem("user_session_token");
  const ownerToken = localStorage.getItem("session_token");
  const token = userToken || ownerToken;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

const apiClient = new WarehouseClient({
  BASE: import.meta.env.VITE_API_URL ?? "",
  WITH_CREDENTIALS: true,
  CREDENTIALS: "include",
  HEADERS: getAuthHeaders,
});

const inventoryApiClient = new WarehouseClient({
  BASE: import.meta.env.VITE_API_URL ?? "",
  WITH_CREDENTIALS: true,
  CREDENTIALS: "include",
  HEADERS: getInventoryAuthHeaders,
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
    }) =>
      withAuthHandling(
        inventoryApiClient.inventory.addStock({ requestBody: data }),
      ),
    countAdjust: (data: {
      warehouse_id: string;
      item_id: string;
      observed_quantity: number;
      bin_id?: string;
    }) =>
      withAuthHandling(
        inventoryApiClient.inventory.countAdjust({ requestBody: data }),
      ),
    removeStock: (data: {
      warehouse_id: string;
      item_id: string;
      quantity: number;
      bin_id?: string;
      owner_override?: boolean;
      request_owner_approval?: boolean;
    }) =>
      withAuthHandling(
        inventoryApiClient.inventory.removeStock({ requestBody: data as any }),
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
        inventoryApiClient.inventory.transferStock({ requestBody: data }),
      ),
    getBalance: (filters?: {
      warehouse_id?: string;
      bin_id?: string;
      item_id?: string;
    }) =>
      withAuthHandling(
        inventoryApiClient.inventory.getInventoryBalance({
          warehouseId: filters?.warehouse_id,
          binId: filters?.bin_id,
          itemId: filters?.item_id,
        }),
      ),
    currentBalance: async (filters?: {
      warehouse_id?: string;
      sku?: string;
    }): Promise<any> => {
      const qs = new URLSearchParams();
      if (filters?.warehouse_id) qs.set("warehouse_id", filters.warehouse_id);
      if (filters?.sku) qs.set("sku", filters.sku);
      const query = qs.toString();
      const url = `${API_BASE}/api/inventory/current-balance${query ? `?${query}` : ""}`;
      const token =
        localStorage.getItem("user_session_token") ||
        localStorage.getItem("session_token");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        localStorage.removeItem("session_token");
        useAuthStore.getState().clearUser();
        window.location.replace("/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || "Request failed"), {
          status: res.status,
          body,
        });
      }
      return res.json();
    },
    getRemovalApprovals: () =>
      withAuthHandling(inventoryApiClient.inventory.getRemovalApprovals()),
    approveRemovalApproval: (approvalId: string) =>
      withAuthHandling(
        inventoryApiClient.inventory.approveRemovalApproval({ id: approvalId }),
      ),
    rejectRemovalApproval: (approvalId: string) =>
      withAuthHandling(
        inventoryApiClient.inventory.rejectRemovalApproval({ id: approvalId }),
      ),
    createManualMovement: async (data: {
      item_id: string;
      warehouse_id: string;
      bin_id?: string;
      quantity: number;
      note?: string;
    }): Promise<{
      movement_id: string;
      type: "MANUAL_ADJUSTMENT";
      item_id: string;
      warehouse_id: string;
      bin_id?: string;
      quantity: number;
      note?: string;
      created_at: string;
    }> => {
      const token =
        localStorage.getItem("user_session_token") ||
        localStorage.getItem("session_token");
      const res = await fetch(`${API_BASE}/api/inventory/movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (res.status === 401) {
        localStorage.removeItem("session_token");
        useAuthStore.getState().clearUser();
        window.location.replace("/login");
        return null as any;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || "Request failed"), {
          status: res.status,
          body,
        });
      }
      return res.json();
    },
  },
  items: {
    getItems: () => withAuthHandling(apiClient.items.getItems()),
    getItem: (itemId: string) =>
      withAuthHandling(apiClient.items.getItem({ id: itemId })),
    createItem: (data: {
      name: string;
      description?: string;
      skus?: string[];
      barcodes?: string[];
    }) => withAuthHandling(apiClient.items.createItem({ requestBody: data })),
    addBarcode: (itemId: string, data: { barcode: string }) =>
      withAuthHandling(
        apiClient.items.addBarcode({ id: itemId, requestBody: data }),
      ),
    addSku: (itemId: string, data: { sku: string }) =>
      withAuthHandling(
        apiClient.items.addSku({ id: itemId, requestBody: data }),
      ),
    searchItems: (q: string) =>
      withAuthHandling(apiClient.items.searchItems({ q })),
    getItemBalance: (itemId: string) =>
      withAuthHandling(apiClient.items.getItemBalance({ id: itemId })),
    getItemMovements: (itemId: string, limit?: number, offset?: number) =>
      withAuthHandling(
        apiClient.items.getItemMovements({ id: itemId, limit, offset }),
      ),
    deleteItem: async (itemId: string): Promise<void> => {
      const token = localStorage.getItem("session_token");
      const response = await fetch(`${API_BASE}/api/items/${itemId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.status === 401) {
        localStorage.removeItem("session_token");
        useAuthStore.getState().clearUser();
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || "Delete failed"), {
          status: response.status,
          body,
        });
      }
    },
    updateItem: (
      itemId: string,
      data: { name?: string; description?: string },
    ) =>
      withAuthHandling(
        apiClient.items.updateItem({ id: itemId, requestBody: data }),
      ),
    addItemSku: (itemId: string, sku: string) =>
      withAuthHandling(
        apiClient.items.addSku({ id: itemId, requestBody: { sku } }),
      ),
    removeItemSku: async (itemId: string, sku: string): Promise<void> => {
      const token = localStorage.getItem("session_token");
      const response = await fetch(
        `${API_BASE}/api/items/${itemId}/skus/${encodeURIComponent(sku)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (response.status === 401) {
        localStorage.removeItem("session_token");
        useAuthStore.getState().clearUser();
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || "Remove SKU failed"), {
          status: response.status,
          body,
        });
      }
    },
    addItemBarcode: (itemId: string, barcode: string) =>
      withAuthHandling(
        apiClient.items.addBarcode({ id: itemId, requestBody: { barcode } }),
      ),
    removeItemBarcode: async (
      itemId: string,
      barcode: string,
    ): Promise<void> => {
      const token = localStorage.getItem("session_token");
      const response = await fetch(
        `${API_BASE}/api/items/${itemId}/barcodes/${encodeURIComponent(barcode)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (response.status === 401) {
        localStorage.removeItem("session_token");
        useAuthStore.getState().clearUser();
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || "Remove barcode failed"), {
          status: response.status,
          body,
        });
      }
    },
  },
  barcodes: {
    lookupItemByBarcode: (barcode: string) =>
      withAuthHandling(apiClient.barcodes.lookupItemByBarcode({ barcode })),
  },
};

export async function bulkUploadBalance(file: File): Promise<{
  processed: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/inventory/bulk-balance`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (response.status === 401) {
    localStorage.removeItem("session_token");
    useAuthStore.getState().clearUser();
    window.location.replace("/login");
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function bulkUploadProducts(file: File): Promise<{
  created: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/items/bulk`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (response.status === 401) {
    localStorage.removeItem("session_token");
    useAuthStore.getState().clearUser();
    window.location.replace("/login");
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export interface ResolvedItem {
  id: string;
  name: string;
  sku: string | null;
}

export async function resolveItemReference(
  identifier: string,
): Promise<ResolvedItem> {
  const trimmed = identifier.trim();

  try {
    const barcodeResult = await client.barcodes.lookupItemByBarcode(trimmed);
    const item = await client.items.getItem(barcodeResult.item_id);

    return {
      id: item.id,
      name: item.name,
      sku: item.skus[0] ?? null,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  let directLookupError: unknown;

  try {
    const item = await client.items.getItem(trimmed);

    return {
      id: item.id,
      name: item.name,
      sku: item.skus[0] ?? null,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }

    directLookupError = error;
  }

  const results = await client.items.searchItems(trimmed);
  const exactSkuMatch = results.find((item) =>
    item.skus.some((sku) => sku.toLowerCase() === trimmed.toLowerCase()),
  );

  if (exactSkuMatch) {
    return {
      id: exactSkuMatch.id,
      name: exactSkuMatch.name,
      sku: exactSkuMatch.skus[0] ?? null,
    };
  }

  throw directLookupError instanceof Error
    ? directLookupError
    : new Error("Item not found");
}

export { ApiError };
