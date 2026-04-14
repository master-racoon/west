import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../lib/api";

export interface Warehouse {
  id: string;
  name: string;
  use_bins: boolean;
  created_at: string;
}

export interface CreateWarehouseRequest {
  name: string;
  use_bins: boolean;
}

export interface UpdateWarehouseRequest {
  name: string;
  use_bins: boolean;
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: () => client.warehouses.getWarehouses(),
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWarehouseRequest) =>
      client.warehouses.createWarehouse(data),
    onSuccess: () => {
      // Invalidate the warehouses list to refetch after creation
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseRequest }) =>
      client.warehouses.updateWarehouse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}
