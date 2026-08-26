import { runFallbackChain } from "./fallbackRunner";

const USER_AGENT = "Spire ( contact@spire.com )";
const MUSICBRAINZ_DELAY_MS = 1100;
const DEFAULT_COVER =
  "https://cdn.saleminteractivemedia.com/shared/images/default-cover-art.png";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function upgradeItunesArtwork(url) {
  if (!url) return "";
  return url.replace("100x100bb", "600x600bb");
}

const getDeezerUrl = (endpoint) => {
  if (import.meta.env.DEV) {
    return `/api/deezer${endpoint}`;
  }
  return `https://corsproxy.io/?${encodeURIComponent(`https://api.deezer.com${endpoint}`)}`;
};

async function fetchWikidataImage(wikidataId) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikidataId}&property=P18&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return "";

  const data = await res.json();
  const imageName = data?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!imageName) return "";

  const cleanImageName = String(imageName).trim().replace(/ /g, "_");
  return `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${cleanImageName}&width=500`;
}

export async function fetchArtistImage(artistName) {
  if (!artistName) return "";
  const cleanName = encodeURIComponent(artistName.trim());

  const result = await runFallbackChain(artistName, [
    {
      name: "Deezer",
      fetcher: async () => {
        const res = await fetch(getDeezerUrl(`/search/artist?q=${cleanName}`));
        if (!res.ok) return null;
        const data = await res.json();
        return data.data?.[0]?.picture_xl || null;
      },
    },
    {
      name: "MusicBrainz",
      fetcher: async () => {
        const mbRes = await fetch(
          `https://musicbrainz.org/ws/2/artist/?query=artist:${cleanName}&fmt=json&limit=1`,
          { headers: { "User-Agent": USER_AGENT } }
        );
        if (!mbRes.ok) return null;
        const mbData = await mbRes.json();
        const artistId = mbData.artists?.[0]?.id;
        if (!artistId) return null;

        // MusicBrainz rate-limits to ~1 req/sec.
        await delay(MUSICBRAINZ_DELAY_MS);

        const relRes = await fetch(
          `https://musicbrainz.org/ws/2/artist/${artistId}?inc=url-rels&fmt=json`,
          { headers: { "User-Agent": USER_AGENT } }
        );
        if (!relRes.ok) return null;
        const relData = await relRes.json();
        const wikiRelation = relData.relations?.find((r) => r.type === "wikidata");
        const wikidataId = wikiRelation?.url?.resource?.split("/").pop();
        if (!wikidataId) return null;

        const imageUrl = await fetchWikidataImage(wikidataId);
        return imageUrl || null;
      },
    },
    {
      name: "iTunes",
      fetcher: async () => {
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${cleanName}&entity=song&limit=1`
        );
        if (!itunesRes.ok) return null;
        const itunesData = await itunesRes.json();
        return upgradeItunesArtwork(itunesData.results?.[0]?.artworkUrl100) || null;
      },
    },
    {
      name: "Wikipedia",
      fetcher: async () => {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${cleanName}&origin=*`,
          { headers: { "User-Agent": USER_AGENT } }
        );
        if (!wikiRes.ok) return null;
        const wikiData = await wikiRes.json();
        const pages = wikiData?.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        const source = pageId !== "-1" ? pages[pageId]?.original?.source : null;
        return source || null;
      },
    },
  ]);

  return result?.data || "";
}

// Unified cover-art chain shared by the upload pipeline and the lazy
// backfill in metadataService.resolveTrackCover.
export async function fetchSongCover(title, artist) {
  const query = `${title} ${artist}`.trim();

  const result = await runFallbackChain(query, [
    {
      name: "iTunes",
      fetcher: async () => {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`
        );
        if (!res.ok) return null;
        const data = await res.json();
        return upgradeItunesArtwork(data.results?.[0]?.artworkUrl100) || null;
      },
    },
    {
      name: "Deezer",
      fetcher: async () => {
        const res = await fetch(getDeezerUrl(`/search/track?q=${encodeURIComponent(query)}`));
        if (!res.ok) return null;
        const data = await res.json();
        return data.data?.[0]?.album?.cover_xl || null;
      },
    },
    {
      name: "JioSaavn",
      fetcher: async () => {
        const saavnUrl =
          "https://www.jiosaavn.com/api.php?__call=search.getResults" +
          "&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=" +
          encodeURIComponent(query);
        const saavnRes = await fetch(saavnUrl);
        if (!saavnRes.ok) return null;
        const saavnData = await saavnRes.json();
        const image = saavnData?.results?.[0]?.image;
        return image ? String(image).replace("150x150", "500x500") : null;
      },
    },
  ]);

  return result?.data || DEFAULT_COVER;
}
