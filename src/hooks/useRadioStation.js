import { useState, useEffect, useCallback } from "react";
import {
  RADIO_STATIONS,
  DEFAULT_STATION_ID,
  getStationById,
} from "@/constants/radioStations";

const STORAGE_KEY = "spire_selected_radio_station";

function readStoredStationId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && getStationById(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function useRadioStation() {
  const [selectedStationId, setSelectedStationId] = useState(
    () => readStoredStationId() || DEFAULT_STATION_ID
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, selectedStationId);
    } catch (err) {
      console.warn("[Radio] Could not persist station selection:", err);
    }
  }, [selectedStationId]);

  const selectStation = useCallback((idOrStation) => {
    const id = typeof idOrStation === "string" ? idOrStation : idOrStation?.id;
    if (id && getStationById(id)) setSelectedStationId(id);
  }, []);

  return {
    stations: RADIO_STATIONS,
    selectedStation: getStationById(selectedStationId) || RADIO_STATIONS[0],
    selectStation,
  };
}