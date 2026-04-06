// Mock API client - in a real app this would be auto-generated from OpenAPI schema
export const client = {
  warehouses: {
    getWarehouses: async () => {
      const response = await fetch("/api/warehouses");
      if (!response.ok) throw new Error("Failed to fetch warehouses");
      return response.json();
    },
    createWarehouse: async (data: { name: string; use_bins: boolean }) => {
      const response = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg = data?.error || "Failed to create warehouse";
        throw new Error(`${response.status}: ${msg}`);
      }
      return response.json();
    },
  },
  bins: {
    createBin: async (data: { warehouse_id: string; name: string }) => {
      const response = await fetch("/api/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const resData = await response.json().catch(() => null);
        const msg = resData?.error || "Failed to create bin";
        throw new Error(`${response.status}: ${msg}`);
      }
      return response.json();
    },
    getBins: async ({ warehouseId }: { warehouseId: string }) => {
      const response = await fetch(`/api/warehouses/${warehouseId}/bins`);
      if (!response.ok) throw new Error("Failed to fetch bins");
      return response.json();
    },
    getBin: async (binId: string) => {
      const response = await fetch(`/api/bins/${binId}`);
      if (!response.ok) throw new Error("Failed to fetch bin");
      return response.json();
    },
  },
};
