export function Logo({ grande }: { grande?: boolean }) {
  const s = grande ? 48 : 30;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="13" fill="var(--acento)" />
      <path d="M17 13h14l6 5-4 5-3-2v14H18V21l-3 2-4-5z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M20 29h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 2.6" />
    </svg>
  );
}
