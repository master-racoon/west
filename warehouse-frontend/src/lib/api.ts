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
};
