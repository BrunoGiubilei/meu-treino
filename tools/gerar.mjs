// Gera css/theme.css (cores M3 claro/escuro + tipografia + formas) e js/icons.js (ícones SVG).
// Uso (dentro de tools/):  npm install  &&  npm run gerar
// Para mudar a cor principal ou as cores dos treinos, edite SEED / TREINO_CORES e rode de novo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------------------------------------------------------- configuração */
const SEED = '#1d4ed8';   // cor-semente: dela saem os papéis primary, secondary, tertiary e neutros

// Cores dos treinos (A–F) e "ok" (meta batida). São cores personalizadas do M3:
// cada uma mantém o seu matiz (blend: false, para o treino continuar reconhecível pela cor) e ganha versão clara e escura.
const TREINO_CORES = { A: '#1d4ed8', B: '#c62828', C: '#2e7d32', D: '#b45309', E: '#7e22ce', F: '#0e7490', ok: '#2e7d32' };

// Ícones usados no app (nomes da biblioteca Material Symbols/Icons)
const ICONES = ['fitness_center', 'history', 'cloud', 'save', 'palette', 'light_mode', 'dark_mode', 'brightness_auto'];

/* ---------------------------------------------------------------- tema */
const theme = themeFromSourceColor(
  argbFromHex(SEED),
  Object.entries(TREINO_CORES).map(([name, value]) => ({ name, value: argbFromHex(value), blend: false })),
);

const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

const SURFACE_TONES = {
  light: { dim: 87, bright: 98, 'container-lowest': 100, 'container-low': 96, container: 94, 'container-high': 92, 'container-highest': 90 },
  dark: { dim: 6, bright: 24, 'container-lowest': 4, 'container-low': 10, container: 12, 'container-high': 17, 'container-highest': 22 },
};

const ROLES = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'outline', 'outlineVariant', 'shadow', 'scrim', 'inverseSurface', 'inverseOnSurface', 'inversePrimary'];

function tokens(mode) {
  const scheme = theme.schemes[mode];
  const out = [];
  for (const role of ROLES) out.push(`--md-sys-color-${kebab(role)}: ${hexFromArgb(scheme[role])};`);
  for (const [name, tone] of Object.entries(SURFACE_TONES[mode])) {
    out.push(`--md-sys-color-surface-${name}: ${hexFromArgb(theme.palettes.neutral.tone(tone))};`);
  }
  for (const custom of theme.customColors) {
    const c = custom[mode];
    const n = custom.color.name;
    out.push(`--md-custom-${n}: ${hexFromArgb(c.color)};`);
    out.push(`--md-custom-on-${n}: ${hexFromArgb(c.onColor)};`);
    out.push(`--md-custom-${n}-container: ${hexFromArgb(c.colorContainer)};`);
    out.push(`--md-custom-on-${n}-container: ${hexFromArgb(c.onColorContainer)};`);
  }
  // texto sobre as cores dos treinos (um valor só, serve para as seis)
  out.push(`--md-custom-on-accent: ${mode === 'light' ? '#ffffff' : '#1b1b1f'};`);
  return out.map(l => '  ' + l).join('\n');
}

const STATIC = `
  /* ---- tipografia (escala do M3) ---- */
  --md-font: Roboto, system-ui, -apple-system, "Segoe UI", sans-serif;
  --md-type-display-large: 400 57px/64px var(--md-font);
  --md-type-display-medium: 400 45px/52px var(--md-font);
  --md-type-display-small: 400 36px/44px var(--md-font);
  --md-type-headline-large: 400 32px/40px var(--md-font);
  --md-type-headline-medium: 400 28px/36px var(--md-font);
  --md-type-headline-small: 400 24px/32px var(--md-font);
  --md-type-title-large: 400 22px/28px var(--md-font);
  --md-type-title-medium: 500 16px/24px var(--md-font);
  --md-type-title-small: 500 14px/20px var(--md-font);
  --md-type-body-large: 400 16px/24px var(--md-font);
  --md-type-body-medium: 400 14px/20px var(--md-font);
  --md-type-body-small: 400 12px/16px var(--md-font);
  --md-type-label-large: 500 14px/20px var(--md-font);
  --md-type-label-medium: 500 12px/16px var(--md-font);
  --md-type-label-small: 500 11px/16px var(--md-font);

  /* ---- formas ---- */
  --md-shape-xs: 4px;
  --md-shape-sm: 8px;
  --md-shape-md: 12px;
  --md-shape-lg: 16px;
  --md-shape-xl: 28px;
  --md-shape-full: 9999px;

  /* ---- elevação ---- */
  --md-elev-1: 0 1px 2px rgb(0 0 0 / 0.30), 0 1px 3px 1px rgb(0 0 0 / 0.15);
  --md-elev-2: 0 1px 2px rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15);
  --md-elev-3: 0 1px 3px rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15);

  /* ---- camadas de estado (hover, foco, pressionado) ---- */
  --md-state-hover: 0.08;
  --md-state-focus: 0.10;
  --md-state-pressed: 0.10;

  /* ---- movimento ---- */
  --md-motion-short: 150ms;
  --md-motion-medium: 250ms;
  --md-motion-easing: cubic-bezier(0.2, 0, 0, 1);`;

// Nomes antigos do style.css apontam para os papéis do M3 (assim as telas antigas já usam o tema novo)
const LEGACY = `
  /* ---- nomes antigos (usados por style.css) -> papéis do M3 ---- */
  --bg: var(--md-sys-color-surface);
  --card: var(--md-sys-color-surface-container-low);
  --text: var(--md-sys-color-on-surface);
  --muted: var(--md-sys-color-on-surface-variant);
  --border: var(--md-sys-color-outline-variant);
  --surface-alt: var(--md-sys-color-surface-container-high);
  --on-accent: var(--md-custom-on-accent);
  --color-A: var(--md-custom-A);
  --color-B: var(--md-custom-B);
  --color-C: var(--md-custom-C);
  --color-D: var(--md-custom-D);
  --color-E: var(--md-custom-E);
  --color-F: var(--md-custom-F);
  --ok: var(--md-custom-ok);`;

const FONTS = [400, 500, 700].map(w => `@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: ${w};
  font-display: swap;
  src: url('../fonts/roboto-latin-${w}-normal.woff2') format('woff2');
}`).join('\n\n');

const css = `/* =========================================================
   Meu Treino — tema Material Design 3
   GERADO por tools/gerar.mjs — não edite à mão (rode o gerador de novo).
   Cor-semente: ${SEED}

   O tema escuro aparece duas vezes de propósito (o gerador cuida disso):
   - dentro do @media: segue o tema do aparelho (modo "auto")
   - em [data-theme="dark"]: força o escuro manualmente
   ========================================================= */

${FONTS}

:root {
${tokens('light')}
${STATIC}
${LEGACY}

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${tokens('dark').replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
${tokens('dark')}
  color-scheme: dark;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --md-motion-short: 0ms;
    --md-motion-medium: 0ms;
  }
}
`;
fs.mkdirSync(path.join(root, 'css'), { recursive: true });
fs.writeFileSync(path.join(root, 'css/theme.css'), css);

/* ---------------------------------------------------------------- ícones */
const iconsDir = path.dirname(fileURLToPath(import.meta.resolve('@material-design-icons/svg/package.json')));
function pathsOf(variant, name) {
  const svg = fs.readFileSync(path.join(iconsDir, variant, name + '.svg'), 'utf8');
  const paths = [...svg.matchAll(/<path\b[^>]*>/g)]
    .filter(m => !/fill="none"/.test(m[0]))
    .map(m => (m[0].match(/\bd="([^"]+)"/) || [])[1])
    .filter(Boolean);
  if (!paths.length) throw new Error('ícone sem caminho: ' + variant + '/' + name);
  return paths.join(' ');
}
const data = Object.fromEntries(ICONES.map(n => [n, { filled: pathsOf('filled', n), outlined: pathsOf('outlined', n) }]));

const js = `/* =========================================================
   Meu Treino — ícones (SVG embutido, funciona offline)
   GERADO por tools/gerar.mjs a partir do Material Icons — não edite à mão.
   ========================================================= */

const ICONS = ${JSON.stringify(data, null, 2)};

/** SVG de um ícone. variant: 'filled' ou 'outlined'. */
export function icon(name, variant = 'outlined', extraClass = '') {
  const paths = ICONS[name] && ICONS[name][variant];
  if (!paths) return '';
  return '<svg class="icon' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + paths + '"/></svg>';
}

/** Par de ícones para itens de navegação: o CSS mostra o preenchido só no item ativo. */
export function iconPair(name) {
  return icon(name, 'outlined', 'icon-outlined') + icon(name, 'filled', 'icon-filled');
}
`;
fs.writeFileSync(path.join(root, 'js/icons.js'), js);
console.log('gerado: css/theme.css e js/icons.js');
