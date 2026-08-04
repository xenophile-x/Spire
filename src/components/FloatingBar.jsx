import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import 'material-symbols/rounded.css';

const navItems = [
  { id: 'home', title: 'Home', icon: 'home', path: '/' },
  { id: 'explore', title: 'Explore', icon: 'explore', path: '/explore' },
  { id: 'album', title: 'Album', icon: 'home_storage', path: '/playlists' },
  { id: 'analytics', title: 'Analytics', icon: 'bar_chart', path: '/analytics' },
  { id: 'settings', title: 'Settings', icon: 'settings', path: '/settings' },
];

export default function FloatingBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="fixed left-14 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center">
      <nav className="flex flex-col p-2 gap-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-2xl items-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              type="button"
              className={`relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 group ${
                isActive
                  ? 'bg-white/15 backdrop-blur-lg text-white shadow-lg scale-105 border border-white/30'
                  : 'hover:bg-white/10 text-white/90 hover:text-white'
              }`}
              title={item.title}
            >
              <span 
                className="material-symbols-rounded text-2xl select-none pointer-events-none transition-transform duration-200 group-hover:scale-110 text-white"
                style={{
                  fontVariationSettings: 
                     "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24"
                
                }}
              >
                {item.icon}
              </span>

              <span className="absolute left-full ml-3 px-2.5 py-1 bg-gray-900/90 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap shadow-lg backdrop-blur-sm border border-white/10">
                {item.title}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}