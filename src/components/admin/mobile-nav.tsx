"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { AdminNav, SidebarFooter, type NavBadges, type NavKey } from "./nav";

/** Phones and tablets: the sidebar as a floating sheet that slides in from the left, always open. */
export function MobileNav({ allowed, badges, siteName, logout }: { allowed: NavKey[]; badges?: NavBadges; siteName?: string; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
          <MenuIcon />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-open=""
          className="group/side fixed inset-y-3 left-3 z-50 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-5 overflow-hidden rounded-3xl border bg-card px-3 py-4 shadow-2xl data-[state=open]:animate-in data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:slide-in-from-left"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <Brand suffix="Admin" name={siteName} markClassName="size-9" className="h-12 px-1.5" />
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <AdminNav allowed={allowed} badges={badges} onNavigate={close} />
          </div>
          <SidebarFooter logout={logout} onNavigate={close} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
