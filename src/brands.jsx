import React from 'react';

/**
 * Stylised merchant marks.
 *
 * These are ORIGINAL glyphs drawn for this prototype in each merchant's
 * recognisable colour. They are not the real trademarks and are not fetched
 * from any logo service, which keeps the demo offline-safe and avoids shipping
 * third-party brand assets. Merchant names and prices are illustrative
 * fixtures, per the product brief.
 */

const G = (a, b) => ({ a, b });

export const BRAND = {
  Netflix: G('#e50914', '#b20710'),
  Spotify: G('#1ed760', '#12a24a'),
  'Planet Fitness': G('#7d2b8b', '#4e1a58'),
  'Roblox Premium': G('#e2231a', '#9c1712'),
  ABCmouse: G('#f7931e', '#d4720a'),
  ChatGPT: G('#10a37f', '#0b7a5e'),
  Headspace: G('#ff7a00', '#e05e00'),
  CloudVault: G('#3d8bff', '#1f5fd0'),
  'Prime Video': G('#00a8e1', '#0076a8'),
  'Apple TV': G('#b9c0cc', '#7e8794'),
  GamePass: G('#107c10', '#0a5a0a'),
  Readly: G('#ff3b5c', '#c72243'),
  Adobe: G('#fa0f00', '#c00c00'),
  FitCoach: G('#00d4a0', '#00a37b'),
  LanguageLab: G('#5b5bd6', '#3a3aa8'),
  NewsDaily: G('#c9a227', '#8f7118'),
  KidsLearn: G('#ff5fa2', '#d63b7e'),
  PhotoBox: G('#ff9f1c', '#d97d06'),
  'Canva Pro': G('#00c4cc', '#7d2ae8'),
  'Disney+': G('#113ccf', '#0b2a99'),
  'Harbor Internet': G('#2dd4bf', '#0f9e8d'),
  'City Water': G('#3dc8ff', '#1b8fc4'),
  'Gridline Power': G('#ffd645', '#d4a900'),
  MobileCo: G('#a78bfa', '#7c5cff'),
  'Health Insurance': G('#ff6b81', '#d13c53'),
  'Auto Insurance': G('#8b7cff', '#5f4fd6'),
  'Home Insurance': G('#4ff5c0', '#17d9a0'),
  SubKill: G('#4ff5c0', '#7c5cff'),
};

/** Custom glyphs for the most recognisable shapes. 24x24 viewBox, currentColor. */
const GLYPH = {
  Netflix: (
    <g>
      <path d="M7 3h3.6l6.4 18H13.4L7 3Z" fill="currentColor" opacity=".55" />
      <path d="M7 3h3.4v18H7V3Z" fill="currentColor" />
      <path d="M13.6 3H17v18h-3.4V3Z" fill="currentColor" />
    </g>
  ),
  Spotify: (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.2" strokeWidth="1.6" opacity=".45" />
      <path d="M7.2 9.4c3.4-1 6.8-.7 9.7.9" strokeWidth="2.1" />
      <path d="M7.8 12.8c2.8-.8 5.5-.5 7.9.8" strokeWidth="1.9" />
      <path d="M8.4 16c2.2-.6 4.3-.4 6.2.6" strokeWidth="1.7" />
    </g>
  ),
  'Apple TV': (
    <g fill="currentColor">
      <path d="M4.2 7.4h7.2v2.5H8.9V17H6.7V9.9H4.2V7.4Z" />
      <path d="M12.4 7.4h2.4l1.6 5.6 1.6-5.6h2.4L17.6 17h-2.6l-2.6-9.6Z" />
    </g>
  ),
  'Disney+': (
    <g fill="currentColor">
      <path d="M3.4 7.6c3.6-1 8-1 11 .6 2 1.1 2.2 3 .3 4.1-2.6 1.5-6.6 1.6-9.6.9l.4-1.7c2.5.6 5.8.5 7.7-.6.9-.5.8-1.3-.2-1.8-2.3-1.2-6-1.2-9-.4l-.6-1.1Z" opacity=".9" />
      <path d="M17.8 13h1.7v2.1h2.1v1.7h-2.1V19h-1.7v-2.2h-2.1v-1.7h2.1V13Z" />
    </g>
  ),
  Adobe: (
    <g fill="currentColor">
      <path d="M9.4 3.6 3 20.4h4.1l1.3-3.7h4L9.4 3.6Z" opacity=".65" />
      <path d="M14.6 3.6 21 20.4h-4.4l-4.2-11.9 2.2-4.9Z" />
    </g>
  ),
  ChatGPT: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3.4 19.4 7.7v8.6L12 20.6 4.6 16.3V7.7L12 3.4Z" />
      <path d="M12 8.2v7.6M8.5 10.2v3.6M15.5 10.2v3.6" strokeLinecap="round" />
    </g>
  ),
  GamePass: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M6.6 9.6h4M8.6 7.6v4" />
      <circle cx="16" cy="10.6" r="1.2" fill="currentColor" stroke="none" />
      <path d="M5.6 16.6c-1.4-2.6-1-6 1.2-7.6h10.4c2.2 1.6 2.6 5 1.2 7.6-.8 1.4-2.3 1.2-3-.1l-1-1.9H9.6l-1 1.9c-.7 1.3-2.2 1.5-3 .1Z" />
    </g>
  ),
  'Prime Video': (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M3.6 15.4c4.8 2.6 12 2.6 16.8-.4" />
      <path d="M6.4 5.2h3.2c1.7 0 2.8 1 2.8 2.4S11.3 10 9.6 10H8.2v2.4H6.4V5.2Z" fill="currentColor" stroke="none" />
    </g>
  ),
  'Planet Fitness': (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.4" opacity=".5" />
      <path d="M8 12h8M9.6 9.4v5.2M14.4 9.4v5.2" />
    </g>
  ),
  'Harbor Internet': (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3.6 9c5-4 11.8-4 16.8 0" />
      <path d="M6.6 12.8c3.4-2.7 7.4-2.7 10.8 0" />
      <circle cx="12" cy="17.4" r="1.7" fill="currentColor" stroke="none" />
    </g>
  ),
  MobileCo: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="7.4" y="3.4" width="9.2" height="17.2" rx="2.4" />
      <path d="M10.8 17.6h2.4" strokeLinecap="round" />
    </g>
  ),
  'City Water': (
    <path d="M12 3.6c3.4 4 5.6 6.8 5.6 9.6a5.6 5.6 0 1 1-11.2 0c0-2.8 2.2-5.6 5.6-9.6Z" fill="currentColor" />
  ),
  'Gridline Power': (
    <path d="M13.4 2.6 6 13.4h4.6L10 21.4l7.6-11.2H13l.4-7.6Z" fill="currentColor" />
  ),
};

/** Letterform fallback: the merchant's initial in its own brand colour. */
function Letter({ name }) {
  const ch = name.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '?';
  return (
    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '0.46em', letterSpacing: '-0.04em' }}>
      {ch}
    </span>
  );
}

export function MerchantMark({ name, size = 36, radius = 11 }) {
  const brand = BRAND[name] || { a: '#a78bfa', b: '#7c5cff' };
  const glyph = GLYPH[name];
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        fontSize: size,
        color: '#fff',
        background: `linear-gradient(148deg, ${brand.a} 0%, ${brand.b} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.34), 0 5px 18px -5px ${brand.a}`,
      }}
    >
      {glyph ? (
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" style={{ display: 'block' }}>
          {glyph}
        </svg>
      ) : (
        <Letter name={name} />
      )}
    </span>
  );
}

export default MerchantMark;
