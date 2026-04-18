import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../lib/api";

export interface Item {
  id: string;
  name: string;
  description?: string;
  barcodes: string[];
  barcode_count: number;
  created_at: string;
}

export interface CreateItemRequest {
  name: string;
  description?: string;
  barcodes?: string[];
}

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => client.items.getItems(),
  });
}

export function useItemById(itemId: string | null) {
  return useQuery({
    queryKey: ["items", itemId],
    queryFn: () => {
      if (!itemId) {
        return Promise.resolve(null);
      }

      return client.items.getItem(itemId);
    },
    enabled: !!itemId,
  });
}

export function useItemSearch(query: string) {
  return useQuery({
    queryKey: ["items", "search", query],
    queryFn: () => client.items.searchItems(query),
    enabled: query.length > 0,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemRequest) => client.items.createItem(data),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.setQueryData(["items", item.id], item);
    },
  });
}

export function useAddBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, barcode }: { itemId: string; barcode: string }) =>
      client.items.addBarcode(itemId, { barcode }),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.setQueryData(["items", item.id], item);
    },
  });
}

export interface ItemBalance {
  item_id: string;
  item_name: string;
  warehouses: Array<{
    warehouse_id: string;
    warehouse_name: string;
    total_quantity: number;
    bins: Array<{
      bin_id: string;
      bin_name: string;
      quantity: number;
    }>;
  }>;
}

export interface ItemMovement {
  movement_id: string;
  type:
    | "ADD"
    | "REMOVE"
    | "TRANSFER"
    | "COUNT_ADJUSTMENT"
    | "MANUAL_ADJUSTMENT";
  timestamp: string;
  user_id: string;
  user_name: string;
  quantity: number;
  source_warehouse_id?: string;
  source_warehouse_name?: string;
  dest_warehouse_id?: string;
  dest_warehouse_name?: string;
  source_bin_id?: string;
  source_bin_name?: string;
  dest_bin_id?: string;
  dest_bin_name?: string;
  note?: string;
}

export interface ItemMovementsResponse {
  total: number;
  movements: ItemMovement[];
}

export function useItemBalance(itemId: string | null) {
  return useQuery({
    queryKey: ["items", itemId, "balance"],
    queryFn: () => client.items.getItemBalance(itemId!),
    enabled: !!itemId,
  });
}

export function useItemMovements(
  itemId: string | null,
  limit: number = 100,
  offset: number = 0,
) {
  return useQuery({
    queryKey: ["items", itemId, "movements", limit, offset],
    queryFn: () => client.items.getItemMovements(itemId!, limit, offset),
    enabled: !!itemId,
  });
}
