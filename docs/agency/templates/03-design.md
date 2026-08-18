# Design — <Product Name>

**Author:** Designer · **Reviews:** `01-prd.md`

## 1. Principles
Three, product-specific. Each usable to settle an argument.

## 2. Tokens
Paste-ready. The developer implements these exactly.

```css
:root {
  --color-bg: ;
  --color-surface: ;
  --color-text: ;
  --color-text-muted: ;
  --color-accent: ;
  --color-danger: ;
  --color-border: ;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;

  --text-xs: ; --text-sm: ; --text-base: ; --text-lg: ; --text-xl: ; --text-2xl: ;
  --font-sans: ;
  --radius-sm: ; --radius-md: ; --radius-lg: ;
  --shadow-sm: ; --shadow-md: ;
}
@media (prefers-color-scheme: dark) { :root { /* overrides only */ } }
```

Every foreground/background pair must clear WCAG AA (4.5:1 body, 3:1 large). State
the ratios.

## 3. Components
| Component | Variants | States | Notes |
|---|---|---|---|

## 4. Screens
Per screen from the PRD inventory:

### <Screen>
- **Purpose & first read** — what the eye lands on, in order.
- **Layout** — regions, at 1280 / 768 / 360.
- **Content & copy** — real strings, including headings, labels, button text.
- **States** — default, empty, loading, error, success, permission-denied, offline.
- **Interactions** — what each control does, including the keyboard path.

## 5. Motion
What animates, how long, and the `prefers-reduced-motion` behaviour.

## 6. Accessibility
Focus order, keyboard paths, labels, live regions, hit targets, contrast results.

## 7. UX acceptance checklist
| ID | Check | Screen | How to verify |
|---|---|---|---|
| UX1 | | | |

QA tests these directly. Each must be observable in the UI.
