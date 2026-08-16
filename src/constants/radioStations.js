export const RADIO_STATIONS = [
  { id: "radio-nepal", name: "Radio Nepal", frequency: 88.8, genre: null },
  { id: "ujyaalo", name: "Ujyaalo Radio", frequency: 90.0, genre: null },
  { id: "hits-fm", name: "Hits FM", frequency: 91.2, genre: "Pop" },
  { id: "capital-fm", name: "Capital FM", frequency: 92.4, genre: "Rock" },
  { id: "classic-fm", name: "Classic FM", frequency: 94.6, genre: "Classical" },
  { id: "kantipur", name: "Radio Kantipur", frequency: 96.1, genre: null },
  { id: "image-fm", name: "Image FM", frequency: 97.9, genre: "Alternative" },
  { id: "synergy", name: "Synergy FM", frequency: 100.6, genre: null },
  { id: "sagarmatha", name: "Radio Sagarmatha", frequency: 102.4, genre: null },
  { id: "annapurna", name: "Radio Annapurna", frequency: 106.0, genre: null },
];

export const DEFAULT_STATION_ID = RADIO_STATIONS[0].id;

export function getStationById(id) {
  return RADIO_STATIONS.find((s) => s.id === id) || null;
}

export function formatFrequency(freq) {
  return freq.toFixed(1);
}
