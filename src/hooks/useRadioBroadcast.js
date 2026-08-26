import { useCallback } from "react";
import { buildStationQueue } from "@/utils/stationQueue";
import { getStationAnchor, setStationAnchor } from "@/utils/radioTimeline";

const trackDuration = (t) => Math.max(1, t.duration_seconds || t.duration || 1);

export function useRadioBroadcast(userTracks) {
  const tuneIn = useCallback(
    (station) => {
      const queue = buildStationQueue(station, userTracks);
      if (queue.length === 0) return null;

      const anchor = getStationAnchor(station.id);

      if (!anchor) {

        setStationAnchor(station.id, { trackIndex: 0, offsetSeconds: 0 });
        return { track: queue[0], offsetSeconds: 0 };
      }

      let index = anchor.trackIndex % queue.length;
      let elapsed = (Date.now() - anchor.trackStartAt) / 1000;


      const totalDuration = queue.reduce(
        (sum, t) => sum + trackDuration(t),
        0
      );
      if (totalDuration > 0 && elapsed >= totalDuration) {
        elapsed %= totalDuration;
      }


      let guard = 0;
      while (elapsed >= trackDuration(queue[index]) && guard < queue.length * 3) {
        elapsed -= trackDuration(queue[index]);
        index = (index + 1) % queue.length;
        guard++;
      }
      if (guard >= queue.length * 3) {

        elapsed = Math.min(elapsed, Math.max(0, trackDuration(queue[index]) - 1));
      }

      setStationAnchor(station.id, { trackIndex: index, offsetSeconds: elapsed });
      return { track: queue[index], offsetSeconds: Math.max(0, elapsed) };
    },
    [userTracks]
  );

  return { tuneIn };
}