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
