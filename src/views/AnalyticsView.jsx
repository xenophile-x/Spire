import React, { useMemo } from "react";

export default function AnalyticsView({ listeningHistory = [] }) {
  const stats = useMemo(() => {
    if (!listeningHistory.length) {
      return {
        totalHours: "0h 0m",
        topArtist: "N/A",
        topGenre: "N/A",
        topTrack: "N/A",
        genreBreakdown: [],
        weeklyData: [0, 0, 0, 0, 0, 0, 0],
      };
    }

    // 1. Time Spent (Assumes track duration or defaults to ~3.5 min/track)
    const totalSeconds = listeningHistory.reduce(
      (acc, track) => acc + (track.duration || 210),
      0
    );
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const totalHours = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;

    // Frequency Helper
    const getFrequencyMap = (key) =>
      listeningHistory.reduce((acc, item) => {
        const val = item[key];
        if (val) acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {});

    const getTop = (map, fallback = "N/A") => {
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
      return sorted[0] ? sorted[0][0] : fallback;
    };

    // 2. Favorite Artist & Top Track
    const artistMap = getFrequencyMap("artist");
    const genreMap = getFrequencyMap("genre");
    const trackMap = getFrequencyMap("title");

    const topArtist = getTop(artistMap, "Unknown Artist");
    const topGenre = getTop(genreMap, "Pop");
    const topTrack = getTop(trackMap, "Unknown Track");

    // 3. Genre Breakdown (%)
    const totalGenres = Object.values(genreMap).reduce((a, b) => a + b, 0) || 1;
    const genreBreakdown = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        percentage: Math.round((count / totalGenres) * 100),
      }));

    // 4. Weekly Activity Distribution (Sun-Sat)
    const days = [0, 0, 0, 0, 0, 0, 0];
    listeningHistory.forEach((item) => {
      if (item.played_at) {
        const dayIdx = new Date(item.played_at).getDay();
        days[dayIdx] += 1;
      }
    });
    const maxDay = Math.max(...days, 1);
    const weeklyData = days.map((count) => Math.round((count / maxDay) * 100));

    return {
      totalHours,
      topArtist,
      topGenre,
      topTrack,
      genreBreakdown: genreBreakdown.length
        ? genreBreakdown
        : [
            { name: "Pop", percentage: 50 },
            { name: "Indie", percentage: 30 },
            { name: "Rock", percentage: 20 },
          ],
      weeklyData: weeklyData.some((v) => v > 0)
        ? weeklyData
        : [23, 55, 50, 70, 40, 65, 30],
    };
  }, [listeningHistory]);

  const daysLabel = ["Sun", "Tue", "Wed", "Thu", "Fri", "Sat", "Mon"];

  return (
    <div className="w-full h-full overflow-y-auto max-h-[90vh] text-white p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/40">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-xs text-white/60 mt-0.5">
            Real-time music listening insights based on your library and activity.
          </p>
        </div>
        
      </div>

      {/* TOP ROW: ACTIVITY + METRICS + OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* CARD 1: ACTIVITY BAR CHART */}
        <div className="lg:col-span-5 bg-white/10 border border-white/15 backdrop-blur-2xl rounded-3xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold tracking-wide">Activity</h2>
            <span className="text-xs text-white/60 bg-white/10 px-3 py-1 rounded-full border border-white/10 cursor-pointer hover:bg-white/20">
              Weekly ▾
            </span>
          </div>

          <div className="flex items-end justify-between gap-2 h-44 pt-4 px-1">
            {stats.weeklyData.map((val, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                <div className="w-full bg-white/10 rounded-full h-full max-h-36 flex items-end p-1 group">
                  <div
                    className="w-full bg-white/30 group-hover:bg-white/50 transition-all rounded-full flex items-start justify-center pt-1"
                    style={{ height: `${Math.max(val, 18)}%` }}
                  >
                    <span className="text-[9px] font-bold opacity-80">{val}%</span>
                  </div>
                </div>
                <span className="text-[11px] text-white/50 font-medium">
                  {daysLabel[idx]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2: STACKED QUICK METRICS */}
        <div className="lg:col-span-3 flex flex-col gap-3.5 justify-between">
          
          {/* Time Spent Box */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-2xl rounded-2xl p-3.5 flex items-center gap-3.5 shadow-xl flex-1">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/10">
              <span className="material-symbols-rounded text-xl text-white">schedule</span>
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">{stats.totalHours}</p>
              <p className="text-[11px] text-white/50 font-medium">Time Spent</p>
            </div>
          </div>

          {/* Favorite Artist Box */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-2xl rounded-2xl p-3.5 flex items-center gap-3.5 shadow-xl flex-1">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/10">
              <span className="material-symbols-rounded text-xl text-white">artist</span>
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-base font-bold tracking-tight truncate">{stats.topArtist}</p>
              <p className="text-[11px] text-white/50 font-medium">Favorite Artist</p>
            </div>
          </div>

          {/* Top Music Box */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-2xl rounded-2xl p-3.5 flex items-center gap-3.5 shadow-xl flex-1">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/10">
              <span className="material-symbols-rounded text-xl text-white">queue_music</span>
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-base font-bold tracking-tight truncate">{stats.topTrack}</p>
              <p className="text-[11px] text-white/50 font-medium">Top Music</p>
            </div>
          </div>

        </div>

        {/* CARD 3: GENRE OVERVIEW */}
        <div className="lg:col-span-4 bg-white/10 border border-white/15 backdrop-blur-2xl rounded-3xl p-5 flex flex-col justify-between shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold tracking-wide">Overview</h2>
            <span className="text-xs text-white/60 bg-white/10 px-3 py-1 rounded-full border border-white/10 cursor-pointer hover:bg-white/20">
              Monthly ▾
            </span>
          </div>

          <div className="flex items-center justify-between my-auto py-2">
            
            {/* Donut Chart */}
            <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/10"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-amber-400"
                  strokeDasharray="60, 100"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-sky-400"
                  strokeDasharray="30, 100"
                  strokeDashoffset="-60"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center px-1">
                <span className="text-base font-bold leading-none truncate max-w-[80px]">{stats.topGenre}</span>
                <span className="text-[10px] text-white/50 mt-1">Top Genre</span>
              </div>
            </div>

            {/* Metrics Legend */}
            <div className="space-y-3 pl-4 flex-1">
              {stats.genreBreakdown.map((item, index) => {
                const colors = ["bg-amber-400", "bg-sky-400", "bg-purple-400"];
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${colors[index % colors.length]}`} />
                        <span className="text-white/80 font-medium truncate max-w-[70px]">{item.name}</span>
                      </div>
                      <span className="font-bold text-white/90">{item.percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>

      </div>

  
  );
}