'use client';

import { useState } from 'react';

// Input de contraseña con botón de "mostrar/ocultar".
// Drop-in replacement para <input type="password" ... />.
//
// Uso:
//   <PasswordInput
//     value={password}
//     onChange={e => setPassword(e.target.value)}
//     required
//     minLength={8}
//     placeholder="••••••••"
//     autoComplete="current-password"
//   />

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function PasswordInput(props: Props) {
  const [shown, setShown] = useState(false);
  const { className, style, ...rest } = props;

  return (
    <div className="relative">
      <input
        {...rest}
        type={shown ? 'text' : 'password'}
        className={className}
        style={{ ...style, paddingRight: '3rem' }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShown(s => !s)}
        aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded transition-colors"
        style={{ color: '#888' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888'; }}>
        {shown ? (
          // Ojo tachado (ocultar)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>
        ) : (
          // Ojo abierto (mostrar)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}
