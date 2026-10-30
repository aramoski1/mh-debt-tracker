"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Drawer({
  open, onOpenChange, title, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-inverse/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-panel shadow-overlay">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="text-base font-medium">{title}</Dialog.Title>
            <Dialog.Close className="h-8 rounded-sm border border-line px-2 text-sm">Close</Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
