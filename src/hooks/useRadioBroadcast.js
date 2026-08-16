import { useCallback } from "react";
import { buildStationQueue } from "@/utils/stationQueue";
import { getStationAnchor, setStationAnchor } from "@/utils/radioTimeline";

const trackDuration = (t) => t.duration_seconds || t.duration || 0;

export function useRadioBroadcast(userTracks) {
  const tuneIn = useCallback(
    (station) => {
      const queue = buildStationQueue(station, userTracks);
      if (queue.length === 0) return null;

      const anchor = getStationAnchor(station.id);

      if (!anchor) {
        // Never tuned in this tab session — start fresh
        setStationAnchor(station.id, { trackIndex: 0, offsetSeconds: 0 });
        return { track: queue[0], offsetSeconds: 0 };
      }

      let index = anchor.trackIndex % queue.length;
      let elapsed = (Date.now() - anchor.trackStartAt) / 1000;

      // Consume elapsed time across however many tracks "played" while you were away
      let guard = 0;
      while (elapsed >= trackDuration(queue[index]) && guard < queue.length * 3) {
        elapsed -= trackDuration(queue[index]);
        index = (index + 1) % queue.length;
        guard++;
      }

      setStationAnchor(station.id, { trackIndex: index, offsetSeconds: elapsed });
      return { track: queue[index], offsetSeconds: Math.max(0, elapsed) };
    },
    [userTracks]
  );

  return { tuneIn };
}