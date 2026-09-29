---
name: Cyber Diagnostic Minimal
colors:
  surface: '#111319'
  surface-dim: '#111319'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#191c21'
  surface-container: '#1d2025'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e1e2ea'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#e1e2ea'
  inverse-on-surface: '#2e3036'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#ffb2ba'
  on-secondary: '#670020'
  secondary-container: '#d4004b'
  on-secondary-container: '#ffe6e8'
  tertiary: '#ffe9cd'
  on-tertiary: '#432c00'
  tertiary-container: '#ffc769'
  on-tertiary-container: '#775200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#ffd9dc'
  secondary-fixed-dim: '#ffb2ba'
  on-secondary-fixed: '#400011'
  on-secondary-fixed-variant: '#910030'
  tertiary-fixed: '#ffdeac'
  tertiary-fixed-dim: '#ffba38'
  on-tertiary-fixed: '#281900'
  on-tertiary-fixed-variant: '#604100'
  background: '#111319'
  on-background: '#e1e2ea'
  surface-variant: '#32353b'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.02em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: -0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: -0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  margin: 0.5rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system targets software engineers, security researchers, and front-end performance architects debugging runtime environments via browser extensions and DevTools panels. 

The aesthetic marries utilitarian minimalism with precision high-contrast instrumentation. It evokes the focused clarity of an aerospace heads-up display: deep matte obsidian backdrops, ultra-crisp hairline dividers, and surgical data readouts. Interactive states are sharp, instantaneous, and purposeful—avoiding whimsical motion in favor of zero-latency status transitions. Glowing warning and diagnostic indicators cut through the dark base to command immediate cognitive priority without introducing visual noise.

## Colors

The chromatic architecture relies on a specialized palette of luminous diagnostic accents against a deeply calibrated slate-obsidian neutral scale.

- **Primary (`#00E5FF` - Cyber Cyan):** Primary interactive focus, active inspect cursors, active network requests, and healthy telemetry pings.
- **Secondary (`#FF3366` - Crimson Alert):** Critical runtime exceptions, memory leaks, DOM cycle warnings, and fatal assertion errors.
- **Tertiary (`#FFB300` - Amber Telemetry):** Performance warnings, deprecation notices, layout shift flags, and throttled network states.
- **Success (`#00E676` - Emerald Runtime):** Passing assertions, clean audit passes, and nominal payloads.
- **Neutral Palette:**
  - Base Obsidian: `#0A0D12` (Extension popup & root shell)
  - Surface Substrate: `#11161F` (Panels, inspector trees, and code beds)
  - Surface Raised: `#18202C` (Hover layers, dropdown menus, and sticky headers)
  - Hairline Border: `#222D3D` (Structural grid dividers)
  - Text Low: `#60738C` (Metadata, line numbers, and passive punctuation)
  - Text Normal: `#C5D1DE` (Standard code and labels)
  - Text High: `#F0F6FC` (Active tokens, titles, and values)

Glows are restricted to active diagnostic emitters via calibrated drop-shadows (e.g., `0 0 8px rgba(0, 229, 255, 0.35)`).

## Typography

Typography prioritizes high-density data parsing in constrained viewports. 

- **Inter** governs UI chrome, section headers, contextual tooltips, and modal messages to maintain neutral, distraction-free clarity.
- **JetBrains Mono** powers all developer data: JSON payloads, memory offsets, stack traces, node attributes, status pills, and numeric readouts.

Tabular figures (`font-variant-numeric: tabular-nums`) must be enforced across all numeric outputs to prevent interface jitter during continuous runtime streaming.

## Layout & Spacing

The layout is engineered for extreme information density across two primary form factors:
1. **Chrome Extension Popup:** Rigid 400px width with an 8px perimeter boundary (`margin: 0.5rem`).
2. **DevTools Panel / Dock:** Adaptive dual- or triple-pane split layout utilizing CSS Grid and virtualized flex lists with zero wasted outer margins.

The spacing rhythm uses a micro-4px base grid (`space-xs: 2px`, `space-sm: 4px`, `space-md: 8px`). Panes and inspector tree nodes are separated by single-pixel hairline dividers rather than generous whitespace gaps, ensuring high vertical data throughput without visual occlusion.

## Elevation & Depth

Visual hierarchy is communicated through high-contrast surface tiers and precision hairline boundaries (`1px solid #222D3D`) rather than heavy diffuse drop shadows.

- **Level 0 (Root Base):** `#0A0D12` solid foundation for shell wrappers.
- **Level 1 (Panels & Trees):** `#11161F` with a continuous hairline perimeter.
- **Level 2 (Active Rows & Overlays):** `#18202C` featuring a soft directional luminescence when focused.
- **Diagnostic Illumination:** Floating action overlays, sticky bar indicators, and critical error toasts employ focused accent edge-rings (`box-shadow: 0 0 0 1px #FF3366, 0 4px 12px rgba(255, 51, 102, 0.25)`).

## Shapes

The design uses soft, near-orthogonal geometry (`roundedness: 1`, 4px base border-radius). 

Terminal inputs, badge tags, and code blocks feature precise 4px corners to evoke instrument hardware. Micro-indicators, pills, and status dots leverage fully circular radii (9999px) to contrast immediately with rigid analytical panels. Tab bars, splitter panes, and tree view rows feature flush, zero-radius outer corners to form seamless modular ribbons.

## Components

### Buttons & Quick Actions
- **Primary:** Background `#00E5FF`, label `#0A0D12` (bold 11px JetBrains Mono), `height: 24px`, padding `0 8px`, border radius `4px`. Hover emits a `0 0 8px rgba(0, 229, 255, 0.4)` glow.
- **Ghost/Icon Action:** Transparent background, text `#60738C`, hover text `#F0F6FC`, hover background `#18202C`, `height: 22px`, width `22px`.
- **Diagnostic Trigger (Destructive):** Dark translucent crimson (`rgba(255, 51, 102, 0.12)`), text `#FF3366`, border `1px solid rgba(255, 51, 102, 0.4)`.

### Status Chips & Badges
- Ultra-compact `16px` height, uppercase 9px JetBrains Mono with `letter-spacing: 0.06em`.
- **Status Colors:**
  - Critical/Error: Red outline and background tint (`rgba(255, 51, 102, 0.15)`), text `#FF3366`.
  - Warn: Amber outline and background tint (`rgba(255, 179, 0, 0.15)`), text `#FFB300`.
  - Healthy: Green outline and background tint (`rgba(0, 230, 118, 0.15)`), text `#00E676`.
  - Info: Cyan outline and background tint (`rgba(0, 229, 255, 0.15)`), text `#00E5FF`.

### Lists & Virtualized Data Trees
- Row height: strictly locked at `20px` or `24px` with `padding: 0 4px`.
- Alternate striping avoided in favor of crisp 1px bottom border (`#18202C`).
- **Hover State:** Background `#18202C`.
- **Selected State:** Background `rgba(0, 229, 255, 0.08)` with a 2px solid `#00E5FF` left-accent indicator stripe.

### Inputs & Filter Bars
- Compact `22px` height, background `#0A0D12`, border `1px solid #222D3D`, text `#F0F6FC` in 11px JetBrains Mono.
- Focus: Border shifts to `#00E5FF` with an immediate `0 0 0 1px #00E5FF` outline ring.
- Regex/Case sensitive toggle buttons nested directly within the trailing edge of the input.

### Diagnostic Cards & Inspect Panels
- Background `#11161F`, border `1px solid #222D3D`, `padding: 8px`.
- Headers include an integrated mini-toolbar with monospace counter badges and quick collapse chevrons.

### Code Snippets & Key-Value Inspectors
- Monospace key-value layout: Keys rendered in `#60738C`, string values in `#00E5FF`, numbers in `#FFB300`, and booleans/nulls in `#FF3366`.
- Direct inline copy actions appear on hover with smooth 100ms fade.