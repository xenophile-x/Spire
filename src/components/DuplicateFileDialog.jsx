import React from "react";
import "material-symbols/rounded.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  GlassAlertDialogContent,
} from "@/components/ui/glasscn/glass-alert-dialog";

export default function DuplicateFileDialog({
  open,
  onOpenChange,
  duplicates = [],
  onSkip,
  onReplace,
  onUploadAll,
}) {
  if (!open) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <GlassAlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
            <span className="material-symbols-rounded text-xl">content_copy</span>
            Duplicate{duplicates.length > 1 ? "s" : ""} Detected
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm font-medium leading-relaxed text-white/70">
            {duplicates.length === 1
              ? `"${duplicates[0]}" is already in your library.`
              : `${duplicates.length} files are already in your library:`}
          </AlertDialogDescription>
          {duplicates.length > 1 && (
            <div className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2.5 custom-scrollbar">
              {duplicates.map((name) => (
                <p key={name} className="truncate text-xs font-medium text-white/60">
                  {name}
                </p>
              ))}
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row">
          <AlertDialogAction
            onClick={onSkip}
            className="flex-1 cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-rounded mr-1.5 text-sm">skip_next</span>
            Skip
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onReplace}
            className="flex-1 cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-rounded mr-1.5 text-sm">swap_horiz</span>
            Replace
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onUploadAll}
            className="flex-1 cursor-pointer rounded-full bg-white/90 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-white"
          >
            <span className="material-symbols-rounded mr-1.5 text-sm">upload</span>
            Upload All
          </AlertDialogAction>
        </AlertDialogFooter>
      </GlassAlertDialogContent>
    </AlertDialog>
  );
}
