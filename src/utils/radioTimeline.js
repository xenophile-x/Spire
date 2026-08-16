const STORAGE_KEY = "spire_radio_timelines";

function readAll() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[RadioTimeline] persist failed:", err);
  }
}

export function getStationAnchor(stationId) {
  return readAll()[stationId] || null;
}

// "As of right now, station X is at trackIndex, offsetSeconds into it."
// Back-compute trackStartAt so (Date.now() - trackStartAt)/1000 === offsetSeconds now.
export function setStationAnchor(stationId, { trackIndex, offsetSeconds = 0 }) {
  const all = readAll();
  all[stationId] = { trackIndex, trackStartAt: Date.now() - offsetSeconds * 1000 };
  writeAll(all);
}