import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../lib/api";

export interface AddStockRequest {
  warehouse_id: string;
  barcode_or_item_id: string;
  quantity: number;
  bin_id?: string;
}

export interface InventoryBalanceFilter {
  warehouse_id?: string;
  bin_id?: string;
  item_id?: string;
}

export interface InventoryBalance {
  warehouse_id: string;
  bin_id?: string;
  item_id: string;
  quantity: number;
}

export function useAddStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddStockRequest) => client.inventory.addStock(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory", "balance", variables],
      });
    },
  });
}

export function useInventoryBalance(filters?: InventoryBalanceFilter) {
  return useQuery({
    queryKey: ["inventory", "balance", filters],
    queryFn: () => client.inventory.getBalance(filters),
  });
}
