import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../lib/api";

export interface AddStockRequest {
  warehouse_id: string;
  barcode_or_item_id: string;
  quantity: number;
  bin_id?: string;
}

export interface RemoveStockRequest {
  warehouse_id: string;
  item_id: string;
  quantity: number;
  bin_id?: string;
  owner_override?: boolean;
  request_owner_approval?: boolean;
}

export interface RemoveStockResponse {
  success: true;
  movement_id: string;
  item_id: string;
  warehouse_id: string;
  bin_id?: string;
  quantity_removed: number;
  balance_after: number;
  owner_override_applied: boolean;
}

export interface TransferStockRequest {
  item_id: string;
  quantity: number;
  source_warehouse_id: string;
  dest_warehouse_id: string;
  source_bin_id?: string;
  dest_bin_id?: string;
}

export interface TransferStockResponse {
  movement_id: string;
  item_id: string;
  quantity: number;
  source_warehouse_id: string;
  dest_warehouse_id: string;
  source_balance_after: number;
  dest_balance_after: number;
}

export interface CountAdjustRequest {
  warehouse_id: string;
  item_id: string;
  observed_quantity: number;
  bin_id?: string;
}

export interface CountAdjustResponse {
  movement_id: string;
  item_id: string;
  previous_balance: number;
  new_balance: number;
  delta: number;
  movement_type: "COUNT_ADJUSTMENT";
}

export type RemovalApprovalStatus = "pending" | "approved" | "rejected";

export interface RemovalApproval {
  id: string;
  item_id: string;
  item_name: string;
  warehouse_id: string;
  warehouse_name: string;
  bin_id?: string;
  bin_name?: string;
  quantity_requested: number;
  current_balance: number;
  shortfall: number;
  status: RemovalApprovalStatus;
  requested_by_user_id: string;
  requested_by_name: string;
  approved_by_owner_id?: string;
  approved_by_owner_name?: string;
  movement_id?: string;
  created_at: string;
  decided_at?: string;
}

export interface RemovalApprovalDecisionResponse {
  approval_id: string;
  status: RemovalApprovalStatus;
  movement_id?: string;
  decided_at: string;
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

export function useRemoveStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RemoveStockRequest) =>
      client.inventory.removeStock(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory", "balance", variables],
      });
    },
  });
}

export function useTransferStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TransferStockRequest) =>
      client.inventory.transferStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
    },
  });
}

export function useCountAdjust() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CountAdjustRequest) =>
      client.inventory.countAdjust(data),
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

export function useRemovalApprovals() {
  return useQuery({
    queryKey: ["inventory", "removal-approvals"],
    queryFn: () => client.inventory.getRemovalApprovals(),
    refetchInterval: (query) =>
      query.state.data?.some((approval) => approval.status === "pending")
        ? 15000
        : false,
  });
}

export function useApproveRemovalApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approvalId: string) =>
      client.inventory.approveRemovalApproval(approvalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory", "removal-approvals"],
      });
    },
  });
}

export function useRejectRemovalApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approvalId: string) =>
      client.inventory.rejectRemovalApproval(approvalId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inventory", "removal-approvals"],
      });
    },
  });
}
