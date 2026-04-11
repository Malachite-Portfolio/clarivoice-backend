import { create } from "zustand";
import { Wallet, WalletTransaction } from "../types/models";

type WalletState = {
  wallet: Wallet | null;
  transactions: WalletTransaction[];
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
  setWallet: (wallet: Wallet | null) => void;
  upsertTransaction: (transaction: WalletTransaction) => void;
  setTransactionsPage: (
    transactions: WalletTransaction[],
    nextCursor: string | null,
    append?: boolean
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
};

export const useWalletStore = create<WalletState>((set) => ({
  wallet: null,
  transactions: [],
  nextCursor: null,
  loading: false,
  error: null,
  setWallet: (wallet) => set({ wallet }),
  upsertTransaction: (transaction) =>
    set((state) => {
      const index = state.transactions.findIndex((item) => item.id === transaction.id);
      if (index === -1) {
        return { transactions: [transaction, ...state.transactions] };
      }
      const next = [...state.transactions];
      next[index] = transaction;
      return { transactions: next };
    }),
  setTransactionsPage: (transactions, nextCursor, append = false) =>
    set((state) => ({
      transactions: append ? [...state.transactions, ...transactions] : transactions,
      nextCursor,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clear: () =>
    set({
      wallet: null,
      transactions: [],
      nextCursor: null,
      loading: false,
      error: null,
    }),
}));
