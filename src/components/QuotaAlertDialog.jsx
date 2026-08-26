
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  GlassAlertDialogContent,
} from "@/components/ui/glasscn/glass-alert-dialog";

export default function QuotaAlertDialog({ open, onOpenChange, title, message }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <GlassAlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
            <span className="material-symbols-rounded text-xl">cloud_off</span>
            {title || "Google Drive storage is full"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm font-medium leading-relaxed text-white/70">
            {message ||
              "Your Google Drive storage is full, so this file couldn't be saved. Free up space in Google Drive and try again."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="rounded-full bg-white/90 px-5 py-2 text-xs font-bold text-black transition-all hover:bg-white">
            Got it
          </AlertDialogAction>
        </AlertDialogFooter>
      </GlassAlertDialogContent>
    </AlertDialog>
  );
}
