// GlassSearchBar.jsx
import React, { useState } from 'react';
import 'material-symbols/rounded.css';

export default function GlassSearchBar({ 
  onSearch = () => {}, 
  onBack, 
  onForward,
  canGoBack = true,
  canGoForward = true,
  onThemeToggle // <--- Added prop here
}) {
  const [searchValue, setSearchValue] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      onSearch(searchValue);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  const handleForward = () => {
    if (onForward) {
      onForward();
    } else if (typeof window !== 'undefined') {
      window.history.forward();
    }
  };

  return (
    <header className="w-full max-w-2xl mx-auto p-5 select-none font-sans">
      <div className="flex items-center justify-between h-14 px-3 bg-white/10 backdrop-blur-2xl border border-white/40 rounded-full shadow-2xl gap-3">
        
        {/* Left Action Buttons Group */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button"
            onClick={handleBack}
            disabled={!canGoBack}
            className={`w-9 h-9 rounded-full bg-black/15 flex items-center justify-center text-white/70 transition-all shrink-0 focus:outline-none ${
              canGoBack 
                ? 'hover:bg-black/25 active:scale-95 cursor-pointer text-white/80' 
                : 'opacity-40 cursor-not-allowed text-white/30'
            }`}
            title="Back"
          >
            <span 
              className="material-symbols-rounded text-lg select-none"
              style={{ fontVariationSettings: "'wght' 200" }}
            >
              undo
            </span>
          </button>

          <button 
            type="button"
            onClick={handleForward}
            disabled={!canGoForward}
            className={`w-9 h-9 rounded-full bg-black/15 flex items-center justify-center text-white/70 transition-all shrink-0 focus:outline-none ${
              canGoForward 
                ? 'hover:bg-black/25 active:scale-95 cursor-pointer text-white/80' 
                : 'opacity-40 cursor-not-allowed text-white/30'
            }`}
            title="Forward"
          >
            <span 
              className="material-symbols-rounded text-lg select-none"
              style={{ fontVariationSettings: "'wght' 200" }}
            >
              redo
            </span>
          </button>
        </div>

        {/* Middle Input Capsule */}
        <form 
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-md flex items-center justify-center h-8 px-2 bg-black/20 rounded-full text-white/90 focus-within:ring-1 focus-within:ring-white/30 overflow-hidden"
        >
          <button 
            type="submit"
            className="flex items-center justify-center text-white/40 hover:text-white/70 transition-colors shrink-0 focus:outline-none"
            title="Search"
          >
            <span 
              className="material-symbols-rounded text-sm select-none scale-75 origin-center" 
              style={{ fontVariationSettings: "'wght' 500" }}
            >
              search
            </span>
          </button>
          
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full bg-transparent text-white placeholder-white/50 text-xs font-normal focus:outline-none tracking-wide px-2"
            placeholder="Search by title,album,artists..."
          />
        </form>

        {/* Right Theme Button */}
        <button 
          type="button"
          onClick={onThemeToggle} // <--- Connected click handler here
          className="w-8 h-8 rounded-full bg-black/15 hover:bg-black/25 flex items-center justify-center text-white/70 transition-all active:scale-95 shrink-0 focus:outline-none cursor-pointer"
          title="Toggle Theme"
        >
          <span 
            className="material-symbols-rounded text-lg select-none"
            style={{ fontVariationSettings: "'wght' 300" }}
          >
            light_mode
          </span>
        </button>

      </div>
    </header>
  );
}