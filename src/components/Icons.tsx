const p = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor', 'aria-hidden': true } as const;
export const IconPlay = () => <svg {...p}><path d="M4 2.5v11l9-5.5z" /></svg>;
export const IconPause = () => <svg {...p}><rect x="3.5" y="2.5" width="3" height="11" /><rect x="9.5" y="2.5" width="3" height="11" /></svg>;
export const IconStop = () => <svg {...p}><rect x="3" y="3" width="10" height="10" /></svg>;
export const IconOpen = () => <svg {...p}><path d="M2 3h5l1.5 2H14v8H2z" /></svg>;
