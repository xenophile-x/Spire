// supabase/functions/fetch-artist-photo/index.ts
// Resolves a real iTunes/Apple Music artist photo by:
//   1. Searching the iTunes API for the artist (gets artistId)
//   2. Fetching the artist page and reading its og:image meta tag
//   3. Resizing the artwork URL to a usable square
// Deploy with: supabase functions deploy fetch-artist-photo

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function wikipediaPhoto(artistName: string): Promise<string> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        artistName.trim()
      )}`,
      { headers: { "User-Agent": "Spire/1.0 (music app)" } }
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data?.originalimage?.source || data?.thumbnail?.source || "";
  } catch (err) {
    console.error("wikipedia photo error:", err);
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { artistName } = await req.json();
    if (!artistName || typeof artistName !== "string") {
      return json({ error: "Missing artistName" }, 400);
    }

    // 1. Resolve the artist via the iTunes Search API (musicArtist entity)
    const searchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        artistName.trim()
      )}&entity=musicArtist&limit=1`
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const artist = searchData.results?.[0];
      if (artist?.artistId) {
        const artistUrl =
          artist.artistLinkUrl ||
          `https://music.apple.com/us/artist/${artist.artistId}`;

        // 2. Fetch the artist page and pull the og:image meta tag
        const pageRes = await fetch(artistUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const match = html.match(/<meta\s+property="og:image"\s+content="(.*?)"/i);
          if (match) {
            // 3. Replace the size token (e.g. 1200x630cw / 1200x630bf) with a square we want.
            //    Use "bb" (black/transparent canvas) — "cw" adds a white canvas that shows as
            //    an ugly white border on dark UIs.
            const photoUrl = match[1].replace(/\d+x\d+[a-z]*/i, "600x600bb");
            return json({ photo_url: photoUrl });
          }
        }
      }
    }

    // 4. Fallback: Wikipedia artist photo
    const wiki = await wikipediaPhoto(artistName);
    return json({ photo_url: wiki });
  } catch (err) {
    console.error("fetch-artist-photo error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
