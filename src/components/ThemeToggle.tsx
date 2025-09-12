import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

export const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={`${isDark ? '라이트' : '다크'} 모드로 전환`}
      aria-label={`${isDark ? '라이트' : '다크'} 모드로 전환`}
    >
      {isDark ? '🌞' : '🌙'}
    </button>
  );
};