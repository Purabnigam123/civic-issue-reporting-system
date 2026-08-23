---
name: Civic Horizon
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#424754'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  section-gap: 96px
---

## Brand & Style

The design system is engineered for civic engagement and municipal transparency. It projects an atmosphere of **trust, efficiency, and optimism**. The personality is "Professional Neighbor"—highly capable and technical, yet accessible and community-focused.

The visual style is **Corporate Modern with a Soft Humanist Touch**. It utilizes ample whitespace to reduce cognitive load when reporting complex data, paired with high-quality illustrations and iconography that ground the technology in real-world physical environments. The interface feels light and airy but maintains rigor through structured grids and clear information hierarchy.

## Colors

This color palette is designed for high legibility and a sense of "active resolution."

- **Primary Blue (#3b82f6):** Represents trust, technology, and official governance. Used for primary actions, progress indicators, and key highlights.
- **Secondary Green (#10b981):** A "soft green" accent used to denote success, environmental health, and resolved issues.
- **Primary Text (#0f172a):** A deep navy neutral that provides superior contrast against white backgrounds compared to pure black, maintaining a professional and modern look.
- **Surface Accents:** Soft blue and green washes (5-10% opacity) are used for chip backgrounds and decorative containers to soften the UI.

## Typography

The design system uses **Plus Jakarta Sans** across all levels to maintain a cohesive, modern, and friendly brand voice. Its geometric yet soft letterforms ensure legibility in both dense data tables and large marketing headlines.

- **Headlines:** Use Bold (700) or ExtraBold (800) weights with slightly tightened letter-spacing for a confident, authoritative presence.
- **Body:** Use Regular (400) weight to maximize readability. Line heights are kept generous (1.5x) to ensure the UI feels approachable.
- **Labels:** Small labels and "Overlines" should use SemiBold (600) with increased letter-spacing to distinguish them from body content.

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid grid**. Content is contained within a 1280px max-width container on desktop, centered with responsive margins.

- **Desktop (1024px+):** 12-column grid, 24px gutters.
- **Tablet (768px - 1023px):** 8-column grid, 20px gutters.
- **Mobile (Up to 767px):** 4-column grid, 16px gutters.

Spacing follows an 8px linear scale. Section gaps are intentionally large (96px+) to create a "premium" sense of breathing room, while internal card padding is tighter (24px - 32px) to maintain information density where it matters.

## Elevation & Depth

Hierarchy is established through **Tonal Layering and Soft Ambient Shadows**.

- **Level 0 (Background):** Pure #FFFFFF.
- **Level 1 (Cards/Containers):** Soft white background with a subtle 1px border (#F1F5F9) and a "Civic Glow" shadow: `0px 4px 20px rgba(15, 23, 42, 0.05)`.
- **Level 2 (Interactive/Floating):** Higher elevation for hover states or modals, using a more pronounced but still diffused shadow: `0px 10px 30px rgba(15, 23, 42, 0.08)`.

Avoid heavy blurs or dark shadows. The goal is to make elements appear as if they are resting lightly on a clean surface.

## Shapes

The shape language is consistently **Rounded**, reinforcing the friendly and modern brand persona.

- **Standard Elements:** 8px (0.5rem) radius for standard inputs and buttons.
- **Cards & Containers:** 16px (1rem) radius (rounded-lg) for main content blocks and feature cards.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.

## Components

- **Buttons:** Primary buttons use the #3b82f6 background with white text. Secondary buttons use a light blue ghost style or #3b82f6 outline. All buttons have a min-height of 48px for touch accessibility.
- **Feature Cards:** Use a white background, 16px corner radius, and the Level 1 shadow. Icons within cards should be housed in soft-colored circles (e.g., light blue or green background with 10% opacity).
- **Status Chips:** Small, pill-shaped indicators. Use "Success Green" (#10b981) for resolved issues and "Alert Blue" (#3b82f6) for in-progress tasks.
- **Input Fields:** 1px border (#E2E8F0) that transitions to Primary Blue on focus. Labels should be placed above the field in Label-MD style.
- **Progress Trackers:** Horizontal steppers with thin connecting lines and circular nodes. Completed steps use the Secondary Green to signal positive movement.