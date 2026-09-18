import React from 'react';

interface OrbitLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  className?: string;
  glow?: boolean;
}

const SIZES = {
  xs: 'w-5 h-5',
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  '2xl': 'w-24 h-24',
  hero: 'w-32 h-32 md:w-40 md:h-40',
};

export const OrbitLogo: React.FC<OrbitLogoProps> = ({ 
  size = 'md', 
  className = '', 
  glow = false 
}) => {
  const sizeClass = SIZES[size] || size;

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {glow && (
        <div 
          className="absolute inset-0 rounded-full blur-2xl opacity-40 bg-gradient-to-tr from-sky-400 via-indigo-500 to-fuchsia-500 animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}
      <img
        src="/orbit-logo.svg"
        alt="Orbit AI"
        referrerPolicy="no-referrer"
        className={`relative object-contain transition-transform duration-300 drop-shadow-sm ${sizeClass}`}
      />
    </div>
  );
};
