import React from "react";
import "material-symbols/rounded.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  GlassAlertDialogContent,
} from "@/components/ui/glasscn/glass-alert-dialog";

export default function DeleteTrackConfirmationDialog({
  open,
  onOpenChange,
  track,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <GlassAlertDialogContent glassVariant = "liquid-refract">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
            <span className="material-symbols-rounded text-xl">delete</span>
            Delete Track
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm font-medium leading-relaxed text-white/50">
            Are you sure you want to delete "{track.title}" from your library? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row">
          <AlertDialogCancel
            onClick={() => onOpenChange(false)}
            className="flex-1 cursor-pointer rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-rounded mr-1.5 text-sm">close</span>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="flex-1 cursor-pointer rounded-full bg-red-500/80 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-red-500"
          >
            <span className="material-symbols-rounded mr-1.5 text-sm">delete</span>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </GlassAlertDialogContent>
    </AlertDialog>
  );
}