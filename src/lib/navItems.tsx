// Ítems de navegación compartidos entre SideNav (desktop) y TopNav (móvil).
// Cada item mapea directamente a un índice de capa del motor de profundidad.
// Para agregar uno: añadir entrada aquí y registrar la capa en DeepNavEngine.tsx.
export const NAV_ITEMS = [
  {
    layerIndex: 0,
    label: 'INICIO',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    layerIndex: 1,
    label: 'SISTEMA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <ellipse cx="12" cy="12" rx="10" ry="3.5" />
      </svg>
    ),
  },
  {
    layerIndex: 2,
    label: 'HISTORIA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="12" x2="13" y2="12" />
      </svg>
    ),
  },
  {
    layerIndex: 3,
    label: 'CONSTELAC.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="5"  cy="5"  r="1.8" fill="currentColor" stroke="none" />
        <circle cx="19" cy="7"  r="1.8" fill="currentColor" stroke="none" />
        <circle cx="10" cy="17" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="18" cy="19" r="1.8" fill="currentColor" stroke="none" />
        <line x1="5"  y1="5"  x2="19" y2="7"  strokeWidth="0.8" />
        <line x1="19" y1="7"  x2="10" y2="17" strokeWidth="0.8" />
        <line x1="10" y1="17" x2="18" y2="19" strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    layerIndex: 4,
    label: 'GALERÍA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    layerIndex: 5,
    label: 'MISIONES',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2s-4 4-4 9c0 2.2 4 7 4 7s4-4.8 4-7c0-5-4-9-4-9z" />
        <path d="M8 11c-1.5 0-3 .6-4 2l1 3.5 3.5-1" />
        <path d="M16 11c1.5 0 3 .6 4 2l-1 3.5-3.5-1" />
        <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
] as const
