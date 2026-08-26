import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import { formatFrequency } from "@/constants/radioStations";
import { cn } from "@/lib/utils";

export default function RadioStationDropdown({
  stations,
  selectedStation,
  isRadioMode,
  onSelectStation,
  onStopRadio,
  trigger,
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <GlassDropdownMenuContent
          glassVariant="frosted"
          align="end"
          sideOffset={8}
          className="w-64 max-h-80 overflow-y-auto custom-scrollbar"
        >
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
            Radio Stations
          </div>
          {stations.map((station) => {
            const isActive = isRadioMode && selectedStation?.id === station.id;
            return (
              <DropdownMenuItem
                key={station.id}
                onClick={() => onSelectStation(station)}
                className={cn("flex items-center justify-between gap-3", isActive && "bg-white/15")}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-mono font-bold text-white tabular-nums w-12 shrink-0">
                    {formatFrequency(station.frequency)}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-white truncate">{station.name}</span>
                    {station.genre && (
                      <span className="text-[10px] text-white/50 truncate">{station.genre}</span>
                    )}
                  </div>
                </div>
                {isActive && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
          {isRadioMode && (
            <>
              <div className="my-1 h-px bg-white/10" />
              <DropdownMenuItem onClick={onStopRadio} className="text-red-300">
                <span className="text-xs font-medium">Stop Radio</span>
              </DropdownMenuItem>
            </>
          )}
        </GlassDropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}