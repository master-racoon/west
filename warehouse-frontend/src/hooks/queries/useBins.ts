import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../lib/api";

export interface Bin {
  id: string;
  warehouse_id: string;
  name: string;
  created_at: string;
}

export interface CreateBinRequest {
  warehouse_id: string;
  name: string;
}

export function useCreateBin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBinRequest) => client.bins.createBin(data),
    onSuccess: (data) => {
      // Invalidate the bins list for this warehouse
      queryClient.invalidateQueries({
        queryKey: ["bins", "warehouse", data.warehouse_id],
      });
    },
  });
}

export function useBinsByWarehouse(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ["bins", "warehouse", warehouseId],
    queryFn: () => {
      if (!warehouseId) {
        return Promise.resolve([]);
      }
      return client.bins.getBins({ warehouseId });
    },
    enabled: !!warehouseId,
  });
}

export function useBin(binId: string | undefined) {
  return useQuery({
    queryKey: ["bins", "single", binId],
    queryFn: () => {
      if (!binId) {
        return Promise.resolve(null);
      }
      return client.bins.getBin(binId);
    },
    enabled: !!binId,
  });
}
