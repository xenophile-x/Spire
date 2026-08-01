import React, { useState } from 'react';
import 'material-symbols/rounded.css';

const navItems = [
   {id:'home',icon:'home'},
    {id:'explore',icon:'explore'},
    {id:'album',icon:'home_storage'},
    {id:'analytics',icon:'bar_chart'},
    {id:'settings',icon:'settings'},
];

export default function FloatingBar({ activeTab: controlledActiveTab, onSelectTab }) {
  // Internal state fallback if no parent state is passed
  const [internalActiveTab, setInternalActiveTab] = useState('home');

  // Use parent state if provided, otherwise fallback to internal state
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleSelect = (id) => {
    setInternalActiveTab(id); // Updates internal state
    if (onSelectTab) {
      onSelectTab(id); // Triggers parent handler if supplied
    }
  };

  return (
    <aside className="fixed left-5 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center">
      <nav className="flex flex-col p-2 gap-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-2xl items-center">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              type="button"
              className={`relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 group ${
                isActive
                  /* Active state: Glowing white frosted highlight */
                  ? 'bg-white/15 backdrop-blur-lg text-white shadow-lg scale-105'
                  /* Inactive state: Translucent light gray button */
                  : 'hover:bg-white/10  text-white/90 hover:text-white'
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
            </button>
          );
        })}
      </nav>
    </aside>
  );
}