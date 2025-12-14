import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ThemeContext = createContext();

export const themes = {
  regular: {
    name: 'Regular',
    background: 'from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e]',
    cardBg: 'bg-[#2d1f4a]/50',
    primaryGlow: 'bg-purple-600/20',
    secondaryGlow: 'bg-indigo-600/20',
    accentColor: 'indigo',
    textPrimary: 'text-white',
    textSecondary: 'text-purple-300',
  },
  dark: {
    name: 'Dark',
    background: 'from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a]',
    cardBg: 'bg-[#1a1a1a]/50',
    primaryGlow: 'bg-slate-600/20',
    secondaryGlow: 'bg-zinc-600/20',
    accentColor: 'slate',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-400',
  },
  christmas: {
    name: 'Christmas',
    background: 'from-[#0f2e1a] via-[#1f4a2d] to-[#0f2e1a]',
    cardBg: 'bg-[#1f4a2d]/50',
    primaryGlow: 'bg-red-600/20',
    secondaryGlow: 'bg-green-600/20',
    accentColor: 'red',
    textPrimary: 'text-white',
    textSecondary: 'text-green-300',
  },
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('regular');
  const [userEmail, setUserEmail] = useState('demo@example.com');

  useEffect(() => {
    const loadTheme = async () => {
      const { data } = await supabase
        .from('dialer_settings')
        .select('theme')
        .eq('user_email', userEmail)
        .maybeSingle();

      if (data?.theme && themes[data.theme]) {
        setCurrentTheme(data.theme);
      }
    };

    loadTheme();
  }, [userEmail]);

  const changeTheme = async (newTheme) => {
    if (!themes[newTheme]) return;

    setCurrentTheme(newTheme);

    await supabase
      .from('dialer_settings')
      .upsert({
        user_email: userEmail,
        theme: newTheme,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email'
      });
  };

  const value = {
    currentTheme,
    theme: themes[currentTheme],
    changeTheme,
    themes,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
