# Design — Compass

**Author:** Designer · **Reviews:** `01-prd.md` · **Date:** 2026-08-18 · **Status:** Ready to build

This document is the implementation contract for the UI. Values here are literal:
paste the tokens, use the copy strings verbatim, build the states as written. Where
this document and the PRD disagree, the PRD's `R*` acceptance criteria win and the
deviation is recorded in `02-architecture.md` under *Deviations*.

---

## 1. Principles

**P1 — The number is the hero, and it always shows its working.**
The plan screen exists to deliver one destination and one total. Those two things get
the largest type on the page and sit above the fold at 1280×800. But no figure appears
without a basis line next to it in words ("₹9,400 per traveller × 2"), and every screen
that shows a price carries the provenance footer. When a layout argument comes up —
"can we move the breakdown below the alternatives?" — the answer is whichever ordering
lets a sceptic reconcile the total without scrolling twice.

**P2 — The escape hatch is never more than one Tab away.**
Compass asks questions, which is the exact thing an impatient user will abandon. Every
question screen carries "No preference", "Back" and "Plan my trip now" in the same
place, at the same size, on every render. No question is ever mandatory, no screen is
ever a wall, and no interstitial holds the user for more than 2 seconds. If a proposed
change removes or hides one of those three controls on any render, it is rejected.

**P3 — Say what happened, in the product's own voice, before the user has to ask.**
Compass relaxes constraints, defaults answers and prices from a sample catalogue. Every
one of those is announced in plain sentences on the screen where it took effect —
"3 questions answered for you", "we searched within India instead", "No cheaper option
in this catalogue for these dates". There is no silent fallback and no empty slot. An
empty container is a bug; a sentence explaining the empty container is the design.

---

## 2. Tokens

Paste-ready. Implement exactly. The dark block overrides colours only — spacing, type,
radii and motion are shared.

```css
:root {
  color-scheme: light dark;

  /* ---- Surfaces & text (light) ---- */
  --color-bg:            #F6F4F0;  /* warm paper */
  --color-surface:       #FFFFFF;  /* cards, panels, dialogs */
  --color-surface-2:     #EFEBE4;  /* inset rows, table zebra, disabled fill */
  --color-text:          #14201E;
  --color-text-muted:    #55625F;
  --color-text-disabled: #5F6A67;

  /* ---- Brand & interactive ---- */
  --color-accent:        #0B5B52;  /* deep teal — primary buttons, selected borders */
  --color-accent-hover:  #084640;
  --color-accent-text:   #FFFFFF;  /* text ON --color-accent */
  --color-accent-subtle: #E4EFEC;  /* selected card fill, chips */
  --color-focus:         #1258C8;  /* focus ring only — never a fill */

  /* ---- Status ---- */
  --color-danger:        #B3261E;
  --color-danger-text:   #8C1D18;  /* danger text on --color-danger-subtle */
  --color-danger-subtle: #FDECEA;
  --color-success:       #0E6B3C;
  --color-success-text:  #0E5F35;
  --color-success-subtle:#E6F4EA;
  --color-warn:          #7A4100;  /* "Stretch", relaxation banner */
  --color-warn-text:     #7A4100;
  --color-warn-subtle:   #FFF4E5;
  --color-info-text:     #0B4C8C;
  --color-info-subtle:   #E7F0FA;

  /* ---- Lines ---- */
  --color-border:        #D6D0C6;  /* decorative dividers, card outlines */
  --color-border-strong: #77817E;  /* form control borders, unselected option cards */

  /* ---- Spacing (4px base) ---- */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;
  --space-4: 16px;  --space-6: 24px;  --space-8: 32px;
  --space-10: 40px; --space-12: 48px; --space-16: 64px;

  /* ---- Type ---- */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas,
               "Liberation Mono", "Courier New", monospace;

  --text-xs:   0.75rem;   /* 12px — provenance, plan ID, basis lines */
  --text-sm:   0.875rem;  /* 14px — helper text, table basis, summary bar */
  --text-base: 1rem;      /* 16px — body, labels, inputs, buttons */
  --text-lg:   1.125rem;  /* 18px — option card labels, day headings */
  --text-xl:   1.375rem;  /* 22px — section headings, question heading @360 */
  --text-2xl:  1.75rem;   /* 28px — screen H1, question heading */
  --text-3xl:  2.25rem;   /* 36px — destination H1 and party total on S5 */

  --leading-tight: 1.2;   --leading-snug: 1.35;   --leading-body: 1.55;
  --weight-regular: 400;  --weight-medium: 500;   --weight-bold: 700;

  /* ---- Radii ---- */
  --radius-sm:  6px;   --radius-md: 10px;   --radius-lg: 16px;
  --radius-pill: 999px;

  /* ---- Shadows ---- */
  --shadow-sm: 0 1px 2px rgba(20, 32, 30, 0.08);
  --shadow-md: 0 4px 16px rgba(20, 32, 30, 0.10);
  --shadow-lg: 0 12px 40px rgba(20, 32, 30, 0.20);

  /* ---- Motion ---- */
  --dur-fast: 120ms;  --dur-base: 180ms;  --dur-slow: 260ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);

  /* ---- Layout ---- */
  --width-form: 640px;    /* S1–S4 content column */
  --width-plan: 1120px;   /* S5 content column */
  --appbar-h: 56px;
  --summarybar-h: 44px;
  --tap-min: 44px;        /* minimum hit target, every screen */
  --focus-ring: 3px;
  --focus-offset: 2px;

  /* ---- Layers ---- */
  --z-appbar: 10; --z-summary: 9; --z-sticky-actions: 20;
  --z-dialog-backdrop: 90; --z-dialog: 100;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:            #0F1413;
    --color-surface:       #171D1C;
    --color-surface-2:     #212A28;
    --color-text:          #ECEFEE;
    --color-text-muted:    #A7B2AF;
    --color-text-disabled: #8C9794;

    --color-accent:        #5FD3C0;
    --color-accent-hover:  #7FE0D0;
    --color-accent-text:   #06322C;   /* text ON --color-accent */
    --color-accent-subtle: #16302C;
    --color-focus:         #8AB4FF;

    --color-danger:        #FFB4AB;
    --color-danger-text:   #FFB4AB;
    --color-danger-subtle: #2B1512;
    --color-success:       #7BD99A;
    --color-success-text:  #7BD99A;
    --color-success-subtle:#12251A;
    --color-warn:          #F7BE72;
    --color-warn-text:     #F7BE72;
    --color-warn-subtle:   #2A1F10;
    --color-info-text:     #9EC5F5;
    --color-info-subtle:   #111C2A;

    --color-border:        #313B39;
    --color-border-strong: #7A8683;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.50);
    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.55);
    --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.70);
  }
}
```

### 2.1 Contrast ratios — computed, WCAG 2.1

Body text needs 4.5:1; text ≥ 24px or ≥ 18.66px bold needs 3:1; UI component
boundaries and focus indicators need 3:1 (SC 1.4.11).

**Light theme**

| Foreground | Background | Ratio | Requirement | Result |
|---|---|---|---|---|
| `--color-text` #14201E | `--color-bg` #F6F4F0 | **15.23:1** | 4.5 | PASS |
| `--color-text` | `--color-surface` #FFFFFF | **16.73:1** | 4.5 | PASS |
| `--color-text` | `--color-surface-2` #EFEBE4 | **14.08:1** | 4.5 | PASS |
| `--color-text` | `--color-accent-subtle` #E4EFEC | **14.23:1** | 4.5 | PASS |
| `--color-text-muted` #55625F | `--color-bg` | **5.80:1** | 4.5 | PASS |
| `--color-text-muted` | `--color-surface` | **6.37:1** | 4.5 | PASS |
| `--color-text-muted` | `--color-surface-2` | **5.36:1** | 4.5 | PASS |
| `--color-text-muted` | `--color-accent-subtle` | **5.41:1** | 4.5 | PASS |
| `--color-accent` #0B5B52 | `--color-surface` | **7.98:1** | 4.5 | PASS |
| `--color-accent` | `--color-bg` | **7.26:1** | 4.5 | PASS |
| `--color-accent-text` #FFFFFF | `--color-accent` (button fill) | **7.98:1** | 4.5 | PASS |
| `--color-accent-text` | `--color-accent-hover` #084640 | **10.71:1** | 4.5 | PASS |
| `--color-danger` #B3261E | `--color-surface` | **6.54:1** | 4.5 | PASS |
| `--color-danger` | `--color-bg` | **5.95:1** | 4.5 | PASS |
| `--color-danger-text` #8C1D18 | `--color-danger-subtle` #FDECEA | **7.97:1** | 4.5 | PASS |
| `--color-success-text` #0E5F35 | `--color-success-subtle` #E6F4EA | **6.83:1** | 4.5 | PASS |
| `--color-success` #0E6B3C | `--color-surface` | **6.59:1** | 4.5 | PASS |
| `--color-warn-text` #7A4100 | `--color-warn-subtle` #FFF4E5 | **7.48:1** | 4.5 | PASS |
| `--color-warn` #7A4100 | `--color-surface` | **8.13:1** | 4.5 | PASS |
| `--color-info-text` #0B4C8C | `--color-info-subtle` #E7F0FA | **7.52:1** | 4.5 | PASS |
| `--color-text-disabled` #5F6A67 | `--color-surface-2` (disabled fill) | **4.34:1** | 3.0 (disabled exempt; we clear 3:1 anyway) | PASS |
| `--color-border-strong` #77817E | `--color-surface` | **4.02:1** | 3.0 | PASS |
| `--color-border-strong` | `--color-bg` | **3.66:1** | 3.0 | PASS |
| `--color-border-strong` | `--color-surface-2` | **3.38:1** | 3.0 | PASS |
| `--color-focus` #1258C8 | `--color-bg` | **5.87:1** | 3.0 | PASS |
| `--color-focus` | `--color-surface` | **6.45:1** | 3.0 | PASS |

**Dark theme**

| Foreground | Background | Ratio | Requirement | Result |
|---|---|---|---|---|
| `--color-text` #ECEFEE | `--color-bg` #0F1413 | **16.06:1** | 4.5 | PASS |
| `--color-text` | `--color-surface` #171D1C | **14.77:1** | 4.5 | PASS |
| `--color-text` | `--color-surface-2` #212A28 | **12.72:1** | 4.5 | PASS |
| `--color-text` | `--color-accent-subtle` #16302C | **12.15:1** | 4.5 | PASS |
| `--color-text-muted` #A7B2AF | `--color-bg` | **8.52:1** | 4.5 | PASS |
| `--color-text-muted` | `--color-surface` | **7.84:1** | 4.5 | PASS |
| `--color-text-muted` | `--color-surface-2` | **6.75:1** | 4.5 | PASS |
| `--color-accent` #5FD3C0 | `--color-surface` | **9.41:1** | 4.5 | PASS |
| `--color-accent` | `--color-bg` | **10.24:1** | 4.5 | PASS |
| `--color-accent` | `--color-accent-subtle` | **7.75:1** | 4.5 | PASS |
| `--color-accent-text` #06322C | `--color-accent` (button fill) | **7.71:1** | 4.5 | PASS |
| `--color-accent-text` | `--color-accent-hover` #7FE0D0 | **8.98:1** | 4.5 | PASS |
| `--color-danger` #FFB4AB | `--color-surface` | **10.06:1** | 4.5 | PASS |
| `--color-danger-text` | `--color-danger-subtle` #2B1512 | **10.15:1** | 4.5 | PASS |
| `--color-success-text` #7BD99A | `--color-success-subtle` #12251A | **9.37:1** | 4.5 | PASS |
| `--color-success` | `--color-surface` | **9.95:1** | 4.5 | PASS |
| `--color-warn-text` #F7BE72 | `--color-warn-subtle` #2A1F10 | **9.65:1** | 4.5 | PASS |
| `--color-warn` | `--color-surface` | **10.22:1** | 4.5 | PASS |
| `--color-info-text` #9EC5F5 | `--color-info-subtle` #111C2A | **9.61:1** | 4.5 | PASS |
| `--color-text-disabled` #8C9794 | `--color-surface-2` | **4.61:1** | 3.0 | PASS |
| `--color-border-strong` #7A8683 | `--color-bg` | **4.93:1** | 3.0 | PASS |
| `--color-border-strong` | `--color-surface` | **4.53:1** | 3.0 | PASS |
| `--color-border-strong` | `--color-surface-2` | **3.90:1** | 3.0 | PASS |
| `--color-focus` #8AB4FF | `--color-bg` | **8.90:1** | 3.0 | PASS |
| `--color-focus` | `--color-surface` | **8.18:1** | 3.0 | PASS |

**The one contrast trap, and its resolution.** `--color-focus` against
`--color-accent` (a primary button's own fill) is only 1.24:1 light / 1.15:1 dark. The
focus ring is therefore **always drawn outside the element with a gap**, so its
neighbouring colour is the page or surface behind, not the button:

```css
:focus-visible {
  outline: var(--focus-ring) solid var(--color-focus);
  outline-offset: var(--focus-offset);
}
```

The 2px offset gap renders in `--color-bg` / `--color-surface`, where the ring clears
5.87:1 and 6.45:1. No inset focus rings anywhere. `--color-border` (1.40:1) is
decorative only — dividers, hairlines and non-essential card outlines. Anything that
communicates an interactive boundary (input borders, unselected option cards, the
textarea in the export dialog) uses `--color-border-strong`.

**Never used:** colour as the only carrier of meaning. The budget line pairs its colour
with a word ("under" / "On budget" / "Stretch"); a selected card pairs its accent
border with a check glyph and `aria-pressed="true"`; an errored field pairs its danger
border with a text message and an alert glyph.

---

## 3. Components

| Component | Variants | States | Notes |
|---|---|---|---|
| **AppBar** | default | static | Height `--appbar-h`, `--color-surface`, 1px bottom `--color-border`. Left: "Compass" wordmark (`--text-lg`, `--weight-bold`, `--color-accent`) + tagline "guided trip planner" (`--text-xs`, `--color-text-muted`, hidden below 768). Right: "Start over" ghost button (hidden on S1 when no session). Not sticky on S1; `position: sticky; top: 0` on S2–S6. |
| **SummaryBar** | basics-only, full | live-updating | `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Sticky under AppBar, height `--summarybar-h`, `--color-accent-subtle` fill, `--text-sm`, `--color-text`. Shown from S2 onwards. Content: `5 nights · 2 travellers · from Bengaluru · ₹60,000`, separator `·` with `--space-2` either side. |
| **ProvenanceFooter** | default | static, non-dismissable | `--text-xs`, `--color-text-muted`, top border `--color-border`, `--space-4` padding. Present on S1, S2, S3, S5 and inside S6's export text. No close control exists. |
| **VibeCard** | — | default, hover, focus-visible, selected, disabled(never) | `<button type="button" aria-pressed>`. Min height 132px, `--radius-lg`, `--color-surface`, 2px `--color-border-strong` border, `--shadow-sm`. Inline SVG glyph 28px `--color-accent` top-left, label `--text-lg` `--weight-medium`, description `--text-sm` `--color-text-muted`. Hover: border `--color-accent`, `--shadow-md`, translateY(-2px). Selected: 2px `--color-accent` border + inset 0 0 0 1px `--color-accent` (reads as 3px), fill `--color-accent-subtle`, check glyph 20px top-right in `--color-accent`. |
| **OptionButton** | standard, no-preference | default, hover, focus-visible, selected | `<button type="button" aria-pressed>`, full width, min-height 56px, `--radius-md`, left-aligned label `--text-lg` + optional description `--text-sm` muted, right chevron 20px `--color-text-muted`. `no-preference` variant: dashed 2px `--color-border-strong`, no chevron, always last in the list. |
| **Button** | primary, secondary, ghost, danger-ghost | default, hover, active, focus-visible, disabled, busy | Min-height `--tap-min`, padding `0 var(--space-6)`, `--radius-md`, `--text-base` `--weight-medium`. primary = `--color-accent` fill / `--color-accent-text`. secondary = transparent fill, 2px `--color-accent` border, `--color-accent` text. ghost = no border, `--color-text-muted` text, underline on hover. danger-ghost = `--color-danger` text. Disabled: `--color-surface-2` fill, `--color-text-disabled` text, `cursor: not-allowed`; uses `disabled` + `aria-disabled="true"` and stays in the tab order is **not** required — a real `disabled` attribute is used. |
| **TextField / NumberField / DateField / Select** | — | default, focus, error, disabled | `<label>` above (`--text-sm` `--weight-medium`), control min-height `--tap-min`, 2px `--color-border-strong`, `--radius-sm`, `--color-surface` fill, `--text-base`. Focus: ring per §6. Error: border `--color-danger` 2px, `aria-invalid="true"`, `aria-describedby` pointing at the FieldError id (and at the hint id when both exist). NumberField for money renders a `₹` prefix glyph inside the control, `font-variant-numeric: tabular-nums`. |
| **FieldHint** | — | static | `--text-sm` `--color-text-muted`, directly under the control, id `hint-<field>`. |
| **FieldError** | — | enter | `--text-sm` `--color-danger`, `--weight-medium`, 16px alert-triangle SVG inline before the text, id `err-<field>`, `role="alert"` on the first error only (others are referenced by `aria-describedby`). |
| **ErrorSummary** | — | shown when ≥2 fields invalid | `--color-danger-subtle` fill, 3px left border `--color-danger`, `--radius-md`, `tabindex="-1"`, `role="alert"`. Heading + a `<ul>` of anchor links to each field. |
| **Badge** | success, warn, neutral, accent | static | Pill, `--text-sm` `--weight-medium`, `--space-1` / `--space-3` padding. success = `--color-success-subtle` / `--color-success-text`. warn = `--color-warn-subtle` / `--color-warn-text`. neutral = `--color-surface-2` / `--color-text-muted`. accent = `--color-accent-subtle` / `--color-accent`. |
| **Banner** | info, warn, danger | default, resolved | Full content width, `--radius-md`, matching `-subtle` fill, 3px left border in the matching solid colour, 20px glyph, heading `--text-base` `--weight-bold`, body `--text-sm`, optional action row of ghost/secondary buttons. Never dismissable except the resume banner. |
| **DayBlock** | — | static | `<section>` with `<h3>` "Day 1 · Sat 10 Oct". `--color-surface`, `--radius-md`, `--space-4` padding, `--space-3` gap between blocks. Items are a `<ul>` with a 2px `--color-accent` left rail; each `<li>` has a 16px type glyph (plane / bed / star), a label and an optional `--text-sm` muted detail. |
| **CostTable** | — | static | Semantic `<table>` with `<caption class="visually-hidden">`. Column 1 line item + basis (`--text-sm` muted, second line), column 2 amount right-aligned tabular-nums. Total row: 2px top border `--color-border-strong`, `--weight-bold`, `--text-xl`. Per-person row directly under, `--text-sm` muted. |
| **Disclosure** | — | collapsed, expanded | Native `<details>`/`<summary>`; summary min-height `--tap-min`, `--text-xl` `--weight-bold`, rotating 16px chevron. |
| **AltCard** | saver, stretch, current | default, hover, focus-visible, selected, absent | `--color-surface`, `--radius-md`, 2px `--color-border-strong`. Header row: Badge ("Saver" neutral / "Stretch" warn / "Recommended" accent). Destination `--text-lg` `--weight-medium`, total `--text-xl` tabular-nums, delta `--text-sm` muted. Action: secondary Button "Use this plan". `absent` variant renders the explanatory sentence in `--text-sm` `--color-text-muted` inside a dashed `--color-border-strong` box of the same height. |
| **ProgressBar** | question, generating | determinate | 6px tall, `--radius-pill`, track `--color-surface-2`, fill `--color-accent`. `role="progressbar"` with `aria-valuenow/min/max` and `aria-label`. |
| **Dialog** | — | open, closed | Native `<dialog>` + `showModal()`. Max-width 560px, `--radius-lg`, `--shadow-lg`, backdrop `rgba(20,32,30,0.45)` light / `rgba(0,0,0,0.65)` dark. Focus trapped by the platform; Esc closes. |
| **LiveRegion** | polite, assertive | — | One `role="status"` (polite) node mounted for the app's life, plus per-screen `role="status"` regions listed in §6.3. Never more than one assertive region on screen. |
| **Icon** | inline SVG only | — | `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, round caps/joins, `aria-hidden="true"`, `focusable="false"`. No icon library, no font, no runtime fetch. Paths in §3.1. |

### 3.1 Icon set — inline SVG path data

Six vibe glyphs plus five UI glyphs. This is the complete icon inventory; nothing else
is drawn.

| Name | Path(s) |
|---|---|
| mountains | `M2 19h20` · `M2.5 19 9 8l4.2 6.8` · `M11 19l5.2-8.4L21.5 19` |
| beach | `M17 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z` · `M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0` · `M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0` |
| party | `M3.5 21l4.8-12.6 7.8 7.8L3.5 21z` · `M9 15l-4.2 1.4` · `M16 3v2.5` · `M19.5 6.5H22` · `M18.2 3.8l1.8-1.8` |
| honeymoon (heart) | `M12 20.2S4.8 15.6 4.8 10.6A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.2 2.6c0 5-7.2 9.6-7.2 9.6z` |
| peace (moon) | `M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6 8.6 8.6 0 1 0 20.4 14.6z` |
| culture-food | `M3 12h18a9 9 0 0 1-18 0z` · `M4 21h16` · `M9 3c0 2 2 2 2 4` · `M14 3c0 2 2 2 2 4` |
| check | `M4.5 12.5l5 5 10-11` |
| chevron-right | `M9 5l7 7-7 7` (Back reuses it rotated 180°) |
| plane | `M2.5 13.5l19-7-7 19-3-8.5-9-3.5z` |
| bed | `M3 18v-9` · `M3 12h18v6` · `M21 18v-3` · `M6.5 9.5h3` |
| star (experience) | `M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z` |
| alert-triangle | `M12 3.5 22 20H2L12 3.5z` · `M12 10v4.5` · `M12 17.2v.1` |
| copy | `M9 9h11v11H9z` · `M15 5H4v11h3` |

---

## 4. Screens

Global chrome, present unless stated otherwise: **AppBar** (top), **SummaryBar**
(S2–S5), content column centred with `--space-6` side padding at ≥768 and `--space-4`
at 360, **ProvenanceFooter** (bottom of document flow, not fixed).

**The provenance string, verbatim, on S1 / S2 / S3 / S5:**

> Prices are indicative sample data from the Compass catalogue, snapshot 2026‑08‑01. Compass does not sell or reserve anything.

**Banned vocabulary (R16).** No element in the app may have the accessible name or
visible label "Book", "Booking", "Pay", "Checkout" or "Reserve", including inside the
cost breakdown bases and the export text. Use "included experiences", "Stay",
"Travel", "Copy as text". This constraint is a design rule, not a lint suggestion.

---

### S1 — Vibe (`/`) · R1, R15, R16

**Purpose & first read.**
1. H1 "What kind of trip do you want?" — the only large type on screen.
2. The six-card grid — the eye should reach a card within one second; cards are the
   largest interactive objects on the page.
3. The Continue button, visually quiet while disabled.
4. The provenance footer, deliberately last.
   *(When a saved session exists, the resume banner takes position 1 and pushes the
   rest down; it is the only element above the H1.)*

**Layout.**

| Width | Behaviour |
|---|---|
| **1280** | Content column 960px centred. Cards in a 3 × 2 grid, `--space-4` gap, each card 300 × 132. H1 `--text-2xl`, sub-copy `--text-base` muted, `--space-8` below. Continue right-aligned under the grid. Whole screen fits 800px height with no scroll (R1): 56 appbar + 32 + 34 H1 + 24 sub + 32 + 296 grid + 24 + 44 button + 32 + 56 footer = 630px. |
| **768** | Column 100% − `--space-12`. Cards in a 2 × 3 grid. Card min-height 124px. Continue full-width-right, still one row. Page may scroll ~40px; acceptable. |
| **360** | Single column of six cards, min-height 96px each, description truncates to one line via `-webkit-line-clamp: 1`. Continue becomes a full-width sticky action bar at the bottom (`position: sticky; bottom: 0`, `--color-bg`, top border `--color-border`, `--space-3` padding, `--z-sticky-actions`). AppBar tagline hidden. |

**Content & copy.**

- H1: `What kind of trip do you want?`
- Sub: `Pick a vibe. We'll ask three or four quick questions, then hand you one costed trip — where to go, where to stay, what to do each day, and the total.`
- Cards (label / description):

| Label | Description | Glyph |
|---|---|---|
| Mountains | Cool air, big views, slow walks. | mountains |
| Beach | Sand, sea, and not much of a plan. | beach |
| Party | Late nights, music, people. | party |
| Honeymoon | Just the two of you, done properly. | honeymoon |
| Peace & Quiet | Nobody around, nothing scheduled. | peace |
| Culture & Food | Old streets, markets, long meals. | culture-food |

- Primary button: `Continue`
- Helper under Continue while disabled: `Pick a vibe to continue.` (`--text-sm`, `--color-text-muted`, id `hint-continue`, referenced by the button's `aria-describedby`).
- Footer: the provenance string above.

**States.**

| State | What renders |
|---|---|
| **Default (first visit)** | Six cards, none pressed. Continue `disabled`. Helper text visible. No resume banner. |
| **Selected** | Chosen card: `aria-pressed="true"`, accent border + fill + check glyph. All others `aria-pressed="false"`. Continue enabled, helper text removed from the DOM. Selecting a second card moves the selection; there is no way to have zero selected once one is chosen. |
| **Empty** | Not reachable — the six vibes are compiled in, not fetched. If the catalogue module fails to load, the whole app renders the *Catalogue error* state below instead of S1. |
| **Loading** | None. S1 is the first paint; there is no fetch. Any skeleton here would be theatre. |
| **Resume (R15)** | Info Banner above the H1. Heading: `You have a trip in progress`. Body, plan case: `Beach · 5 nights from Bengaluru · Kochi & Varkala, ₹51,600`. Body, mid-questionnaire case: `Beach · 5 nights from Bengaluru · Question 2 of 4`. Actions: primary `Resume` → jumps straight to S5 or the saved S3 question; ghost `Start over` → clears storage, banner disappears, focus moves to the H1, live region announces `Saved trip cleared.` |
| **Storage denied (permission-denied)** | Warn Banner under the AppBar on S1 and S2 only. Heading `We can't save your progress in this browser`. Body `Local storage is blocked, so reloading will lose your answers. Everything else works — you can still plan a trip right now.` No action button. Shown once per session; the app never throws on a storage write. |
| **Catalogue error** | Full-screen replacement, centred: H1 `We couldn't load the trip catalogue`, body `Nothing you did caused this. Reload the page and it should come back.`, primary button `Reload`. `role="alert"`. |
| **Offline** | No dedicated state. Compass makes zero network requests after the initial page load; going offline mid-flow changes nothing and must not surface an error. |

**Interactions & keyboard path.**
Tab order: `Skip to content` (visually hidden, first) → Compass wordmark (not focusable — plain text) → resume banner `Resume` → resume banner `Start over` → AppBar `Start over` (only when a session exists) → card 1 … card 6 → `Continue`. Arrow keys do **not** move between cards (they are buttons, not a radio group, so a mis-typed arrow can never change an answer); Tab and Shift+Tab move, Enter/Space select. Clicking Continue navigates to S2 and moves focus to the S2 H1.

---

### S2 — Trip basics · R2, R3, R16

**Purpose & first read.**
1. The SummaryBar, already reading `5 nights · 2 travellers · from Bengaluru · ₹60,000` from the pre-filled defaults — the user sees the answer before they've typed.
2. H1 "Your trip basics".
3. The date pair, which is the field most likely to need changing.
4. Budget, travellers, departure city.
5. Continue.

**Layout.**

| Width | Behaviour |
|---|---|
| **1280** | Form column `--width-form` (640px) centred in a `--color-surface` card, `--radius-lg`, `--space-8` padding, `--shadow-sm`. Start and End dates share a row (2 × 1fr, `--space-4` gap). Budget and Travellers share a row. Departure city full width. Back (ghost, left) and Continue (primary, right) in one action row. |
| **768** | Identical to 1280; the card is 640px and simply has less margin. |
| **360** | Card loses its side padding to `--space-4` and its shadow. Every field is full width, one per row. The action row becomes a sticky bottom bar: Continue full width on top, Back as a full-width ghost button below it. |

**Content & copy.**

| Field | Label | Default | Hint |
|---|---|---|---|
| start | `Start date` | first day of next month | — |
| end | `End date` | start + 5 days | `5 nights` (recomputed live as the dates change; e.g. `7 nights`, `1 night`) |
| budget | `Total budget for the whole party` | `60000` | `Everything in: travel, stay, experiences and day-to-day spending.` |
| travellers | `Travellers` | `2` | `Priced per adult traveller. One room per two travellers, rounded up.` |
| origin | `Flying from` | `Bengaluru` | `Six metros for now: Mumbai, Delhi, Bengaluru, Chennai, Kolkata, Hyderabad.` |

- H1: `Your trip basics`
- Sub: `We've filled in the usual answers. Change what's wrong and keep the rest.`
- Buttons: `Back` (ghost) · `Continue` (primary)
- Native controls: `<input type="date">` for dates, `<input type="number" inputmode="numeric">` for budget and travellers, `<select>` for origin. Native pickers only — no custom calendar.

**Error strings — verbatim, one per rule (R3).**

| Rule | Field | String |
|---|---|---|
| end ≤ start | end | `End date must be after your start date` |
| nights > 21 | end | `Trips longer than 21 nights aren't supported yet` |
| budget < 5000 | budget | `Enter a budget of at least ₹5,000` |
| budget non-numeric / blank | budget | `Enter a budget as a number, digits only` |
| travellers outside 1–12 | travellers | `Travellers must be between 1 and 12` |
| travellers blank | travellers | `Enter how many people are travelling` |

ErrorSummary heading, shown only when two or more fields are invalid:
`2 things to fix before we can plan` (the number is the live count; singular form
`1 thing to fix before we can plan` when validation runs on a single field via blur).

**States.**

| State | What renders |
|---|---|
| **Default** | All five fields pre-filled per the table. No errors. SummaryBar live. Continue enabled — validation happens on submit, not by disabling the button, so the user always gets told *why*. |
| **Live editing** | Every keystroke/commit updates the SummaryBar (`role="status"`, polite). Nights recompute in the end-date hint. Budget renders grouped as the user types (`60,000`) via an Indian-grouping formatter on blur, never mid-keystroke. |
| **Error (single field)** | On Continue: screen does not change, first invalid field gets `aria-invalid="true"`, `aria-describedby="hint-x err-x"`, 2px `--color-danger` border, FieldError below with alert glyph. Focus moves to that field within 100ms. |
| **Error (multiple fields)** | ErrorSummary appears above the H1, receives focus, lists each error as a link (`<a href="#field-budget">Enter a budget of at least ₹5,000</a>`). Clicking a link focuses that field. Every invalid field also shows its own inline FieldError. |
| **Error cleared** | An error is removed on the field's next valid `input` event, not only on resubmit. The ErrorSummary re-renders with the remaining count, or is removed at zero. |
| **Success** | Continue with valid data advances to S3; focus moves to the S3 question heading; SummaryBar persists with no re-announcement of unchanged text. |
| **Empty** | Not reachable — defaults mean the form is never blank. If a saved session contained a partial basics record, missing fields fall back to the defaults rather than rendering empty. |
| **Loading** | None. Validation and nights derivation are synchronous. |
| **Permission-denied** | The storage banner from S1 persists here. |
| **Offline** | No change. |

**Interactions & keyboard path.**
Skip link → AppBar `Start over` → start → end → budget → travellers → origin → `Back` → `Continue`. Enter inside any field submits the form (same as Continue). The SummaryBar is not focusable.

---

### S3 — Adaptive question (one component, 3–5 renders) · R4, R5, R6, R15

**Purpose & first read.**
1. Progress line "Question 2 of 4" and the progress bar — the user must know how much is left before they read the question.
2. The question, `--text-2xl`, one sentence.
3. Two to four option rows.
4. "No preference".
5. The row of `Back` and `Plan my trip now`.

**Layout.**

| Width | Behaviour |
|---|---|
| **1280** | Column `--width-form`. Progress bar full column width, progress text right-aligned above it. Question H1 `--text-2xl`. Options stacked full width, `--space-3` gap, min-height 56px. Action row: `Back` ghost left, `Plan my trip now` secondary right. |
| **768** | Identical. |
| **360** | Question drops to `--text-xl`. Option descriptions stay (they are how the user tells options apart) but wrap to two lines; min-height grows to 64px. Action row becomes sticky bottom: `Plan my trip now` full-width secondary on top, `Back` full-width ghost below. The progress text moves above the bar on its own line, left-aligned. |

**Content & copy.**

- Progress: `Question 2 of 4` (`--text-sm`, `--color-text-muted`). ProgressBar `aria-label="Questionnaire progress"`, `aria-valuenow` = answered count, `aria-valuemax` = total for the current branch.
- Question headings and options are catalogue data owned by the decision graph. The Beach branch, written out, is the reference implementation and must ship exactly:

| # | Heading | Options (label / description) |
|---|---|---|
| Q1 | `Within India, or international?` | `Within India` — *Shorter flights, no visa, fewer surprises.* · `International` — *Passport out, more time in the air.* · `No preference` |
| Q2a (after *International*) | `How long a flight are you willing to sit through?` | `Under 6 hours` — *Southeast Asia, the Gulf, Sri Lanka.* · `Happy with long-haul` — *Anywhere the budget reaches.* · `No preference` |
| Q2b (after *Within India*) | `Which coast are you drawn to?` | `West coast` — *Konkan, Goa, Karnataka.* · `East coast` — *Tamil Nadu, Andhra, Odisha.* · `Islands` — *Andaman & Lakshadweep.* · `No preference` |
| Q3 | `Lively beach or empty beach?` | `Lively` — *Shacks, music, people around.* · `Empty` — *Long walks, nobody there.* · `One lively night, otherwise quiet` — *A bit of both.* · `No preference` |
| Q4 | `Resort comfort or local stays?` | `Resort comfort` — *Pool, service, predictable.* · `Local stays` — *Homestays and small properties.* · `No preference` |

- "No preference" description, on every question: `We'll pick this one for you.`
- Buttons: `Back` · `Plan my trip now`
- Helper under the action row (`--text-sm` muted): `You can stop answering at any point — we'll fill in the rest.`
- Footer: provenance string.

**States.**

| State | What renders |
|---|---|
| **Default (unanswered)** | No option pressed. Every option `aria-pressed="false"`. On the first question, `Back` returns to S2. |
| **Answered (arrived via Back, R6)** | The previously chosen option is `aria-pressed="true"` with accent border and check glyph, and receives focus on mount. Nothing auto-advances. |
| **Choosing** | Clicking or pressing Enter on an option sets `aria-pressed="true"`, then advances after `--dur-base` (180ms) so the selection is visible. With `prefers-reduced-motion: reduce`, the advance is immediate. |
| **Branch invalidated (R6)** | Changing an answer that changes the branch discards only the answers that depended on it. A neutral Banner appears on the *next* question for that render only: heading `We've updated the rest of the questions`, body `Your earlier answers are still in the summary bar.` The SummaryBar never changes on this path. |
| **Last question answered** | Goes to S4. |
| **Skip (R5)** | `Plan my trip now` fills every unanswered question with its neutral default and goes to S4. The count of defaulted questions is carried to S5. |
| **Empty** | Not reachable — the graph always yields between 3 and 5 questions. If the graph resolves to zero remaining questions, the app goes straight to S4; it never renders a question screen with no options. |
| **Loading** | None. Deriving the next question is synchronous. |
| **Error** | Not reachable — all inputs are closed choices, so there is no invalid answer to reject. |
| **Restored session (R15)** | On reload the app returns to this exact question index with all prior answers intact and the SummaryBar unchanged. Focus lands on the question heading. |
| **Permission-denied / Offline** | No visual change; the storage banner is not repeated past S2. |

**Interactions & keyboard path.**
Skip link → AppBar `Start over` → option 1 … option n → `No preference` → `Back` → `Plan my trip now`. Options are `<button>`s, so arrow keys move nothing — a stray arrow key can never change an answer. On every question change, focus moves to the `<h1>` (`tabindex="-1"`) except when arriving via Back, where it moves to the previously chosen option.

---

### S4 — Generating · R7

**Purpose & first read.** One line of honest status text, centred. This screen exists
to name the work, not to fake it. There is no branded animation and no "Did you know?"
trivia.

**Layout.** Identical at all three widths: content column `--width-form`, vertically
centred in the viewport minus the AppBar and SummaryBar. Icon 40px compass-free (we use
the `star` glyph in `--color-accent`), heading, status line, progress bar 240px wide
(full width at 360).

**Content & copy.**

- Heading (`--text-2xl`): `Planning your trip`
- Status line (`--text-base`, `--color-text-muted`), stepping through three strings on a fixed schedule regardless of how fast the engine actually is:
  - 0 ms — `Scoring 14 destinations against your answers`
  - 300 ms — `Pricing flights from Bengaluru` (origin city interpolated)
  - 600 ms — `Building your day-by-day`
- Sub-line (`--text-xs`, muted): `This runs on your device — nothing is sent anywhere.`

**States.**

| State | What renders |
|---|---|
| **Default (loading — this screen *is* the loading state)** | Heading + stepping status line + determinate ProgressBar animating 0 → 100% over 800ms. The screen is shown for a **minimum of 600ms** (so the status text is readable rather than a flash) and a **maximum of 2000ms** (R7); if the engine somehow has not resolved at 2000ms, the app renders whatever plan the relaxation path produced and never holds longer. |
| **Success** | Replaced by S5. Focus moves to the S5 `<h1>`. |
| **Error** | If the engine throws, this screen is replaced by: H1 `Something went wrong building your plan`, body `Your answers are safe. Try again, or change an answer and we'll rebuild it.`, primary `Try again`, ghost `Start over`. `role="alert"`. A blank screen is never a legal outcome. |
| **Empty** | Not reachable — R14 guarantees a plan. "No results" has no visual design because it must never be rendered. |
| **Permission-denied / Offline** | No change; the computation is local. |

**Interactions & keyboard path.** No interactive controls except the AppBar `Start
over`. The status line is inside a `role="status"` `aria-live="polite"` region, so each
step is announced. Reduced motion: the ProgressBar renders at a static 100% fill with
the text still stepping; nothing animates.

---

### S5 — Plan · R7–R16

**Purpose & first read.**
1. **Destination H1** — `Kochi & Varkala`, `--text-3xl`.
2. **The total** — `₹51,600 total`, `--text-3xl` tabular-nums, immediately right of the H1 at 1280 and immediately below it at 768/360.
3. **The budget badge** — `₹8,400 under your budget`.
4. **The trip facts line** — `5 nights · Sat 10 – Thu 15 Oct 2026 · 2 travellers · from Bengaluru`.
5. **`Copy as text`** — the primary action, since the job ends by getting the plan out.
6. Then, in reading order: itinerary → cost breakdown → why → alternatives → adjust.

All of 1–5 fit above the fold at 1280×800 (hero block is 236px tall including padding,
starting at y = 100 under the AppBar and SummaryBar).

**Layout.**

| Width | Behaviour |
|---|---|
| **1280** | Content column `--width-plan` (1120px). Hero full width. Below it a two-column grid `minmax(0, 2fr) minmax(320px, 1fr)`, `--space-8` gap. **Left:** relaxation banner (if any), Itinerary, Why this trip. **Right (sticky, `top: calc(var(--appbar-h) + var(--summarybar-h) + var(--space-4))`):** Cost breakdown, Alternatives, Adjust panel. The sceptic can read the breakdown while scrolling the days. |
| **768** | Single column, full width. Order becomes: relaxation banner → hero → Cost breakdown → Itinerary → Why this trip → Alternatives → Adjust. The breakdown is promoted above the itinerary because at this width nothing is sticky and the number must not be two screens away from the total. Nothing is hidden or collapsed that was open at 1280. |
| **360** | Same single-column order as 768. Hero stacks: H1, then total, then badge, then facts line (facts wrap to two lines, `·` separators preserved, never truncated with an ellipsis). `Copy as text` and `Start over` move into a sticky bottom action bar. Cost table keeps two columns (label wraps, amount stays right-aligned) — it never becomes a horizontally scrolling table. Day blocks keep their left rail. Alternatives stack vertically. |

**Content & copy — the reference plan.** Every string below ships as written, with the
bracketed parts interpolated from the plan.

**Hero**
- H1: `Kochi & Varkala`
- Total: `₹51,600 total` / secondary line `₹25,800 per person`
- Budget badge, one of exactly three forms (R9):
  - success — `₹8,400 under your budget`
  - neutral — `On budget`
  - warn — `Stretch — 10% over your budget`
- Facts: `5 nights · Sat 10 – Thu 15 Oct 2026 · 2 travellers · from Bengaluru`
- Defaults chip, only when questions were skipped (R5): accent Badge `3 questions answered for you`, followed by a ghost button `Answer them` that returns to the first defaulted question with all other answers intact.
- Actions: primary `Copy as text` · ghost `Start over`
- Plan ID line (`--text-xs`, muted, `--font-mono`): `Plan KOCH-5N-2P-B60-a41c · catalogue 2026-08-01`

**Relaxation banner (R14)** — warn Banner, above the hero at every width, not dismissable:
- Heading: `We changed one thing to make this work`
- Body: `No international party trip fits ₹25,000 for 4 — we searched within India instead.`
- Action: secondary button `Put international back`
- After that button is pressed, the same banner re-renders as:
  - Heading: `With international back in`
  - Body: `The cheapest international party trip for 4 over these dates is ₹61,400 — ₹36,400 over your budget.`
  - Actions: primary `Use the ₹61,400 plan` · ghost `Keep the ₹25,000 plan`
  - The change is announced in the plan live region: `Showing the international plan. Bangkok, ₹61,400 total.`

**Itinerary (R7)** — `<h2>` `Your days`. One DayBlock per day, `Day 1` … `Day 6`:

```
Day 1 · Sat 10 Oct
  ✈  Fly Bengaluru → Kochi        06:55–08:15, IndiGo, 1h 20m
  ▤  Check in — Brunton Boatyard  5 nights, 1 room
  ★  Fort Kochi sunset walk       Free · 2 hrs
Day 2 · Sun 11 Oct
  ★  Chinese fishing nets at dawn  Free · 1 hr
  ★  Mattancherry spice market     ₹400 per person
...
Day 6 · Thu 15 Oct
  ▤  Check out — Brunton Boatyard
  ✈  Fly Kochi → Bengaluru        18:40–20:00, IndiGo, 1h 20m
```

The stay entry appears on Day 1 with `5 nights, 1 room` and on the final day as
`Check out`. Every day carries at least one starred experience.

**Cost breakdown (R8)** — `<h2>` `What makes up ₹51,600`:

| Line item | Basis (second line, `--text-sm` muted) | Amount |
|---|---|---|
| Travel | Return flights, ₹9,400 per traveller × 2 | ₹18,800 |
| Stay | Brunton Boatyard, ₹4,200 per room-night × 5 nights × 1 room | ₹21,000 |
| Experiences | 7 included experiences for 2 travellers | ₹6,300 |
| Local allowance | Food and local transport, ₹550 per traveller per day × 2 × 5 | ₹5,500 |
| **Total for 2 travellers** | | **₹51,600** |
| Per person | ₹51,600 ÷ 2, rounded to the nearest ₹100 | ₹25,800 |

Footnote under the table (`--text-sm`, muted): `Priced per adult traveller. One room
per two travellers, rounded up. Children aren't priced separately yet.`

**Why this trip (R10)** — collapsed `<details>`, summary `Why this trip`.
- Sub-heading `Because you said` — a `<ul>` of at least three reasons, each quoting an answer:
  - `You chose Beach — Varkala's cliff beaches score highest for that in this catalogue.`
  - `You said Within India — no visa, and 1h 20m in the air from Bengaluru.`
  - `You said Empty over Lively — Varkala's north cliff rates 2 out of 5 for nightlife.`
  - `Your budget is ₹60,000 for 5 nights — this lands ₹8,400 under it.`
- Sub-heading `Considered and rejected` — a `<ul>`, each with a number:
  - `Bali — ₹18,200 over your budget for 2.`
  - `Goa — rates 4 out of 5 for nightlife, against your "empty beach" answer.`
  - `Andaman — ₹6,900 over, and 2 flight legs each way.`

**Alternatives (R11)** — `<h2>` `Other ways to do this`. Up to two AltCards:
- Saver: Badge `Saver` · `Gokarna & Om Beach` · `₹43,900` · `₹7,700 less than the recommendation` · button `Use this plan`
- Stretch: Badge `Stretch` · `Maafushi, Maldives` · `₹71,400` · `₹19,800 more — within your stretch band` · button `Use this plan`
- Absent-Saver copy: `No cheaper option in this catalogue for these dates`
- Absent-Stretch copy: `No pricier option that still stays inside your stretch band`
- After switching, the previous plan becomes a third card: Badge `Recommended` · `Kochi & Varkala` · `₹51,600` · `₹7,700 more` · button `Use this plan`, so switching back is one click.

**Adjust panel (R12)** — `<fieldset>` with `<legend>` `Adjust and re-plan`.
- Sub-copy: `Change these and we'll re-price without asking the questions again.`
- Fields: `Travellers` (number, 1–12) and `Total budget` (number, ₹).
- Button: `Update plan` — disabled while both values match the current plan; helper `Nothing has changed yet.`
- Validation reuses the exact S2 error strings.

**Footer:** the provenance string, plus `Plan KOCH-5N-2P-B60-a41c · catalogue 2026-08-01`.

**States.**

| State | What renders |
|---|---|
| **Default** | Everything above, relaxation banner absent, Why collapsed. |
| **Loading** | None on this screen. Re-planning (alternative switch or Adjust) is synchronous and updates in place; the app does **not** return to S4 for a re-plan — that would feel like starting again. If a re-plan ever exceeds 150ms, `Update plan` shows a `busy` state (`aria-busy="true"`, label unchanged, 16px spinner replaced by a static dot under reduced motion) rather than a screen change. |
| **Empty** | Structurally impossible for the plan itself (R14). The only empty containers are the two alternative slots, and each has its own sentence above — an empty box is a bug. |
| **Error** | Only reachable from Adjust: invalid travellers/budget shows the S2 inline errors inside the panel, focus moves to the first invalid field, and the displayed plan is left completely untouched. |
| **Success (re-plan applied)** | Hero, breakdown, budget badge, itinerary, why, alternatives and plan ID all update together — never a half-updated screen. The plan live region announces `Plan updated. Gokarna & Om Beach, ₹43,900 total for 4 travellers.` Focus stays on `Update plan`. The questionnaire is not shown. The SummaryBar's vibe and adaptive answers do not change; only nights/travellers/budget do. |
| **Restored (R15)** | On reload the identical plan renders from storage without passing through S4 and without recomputation; the plan ID is byte-identical. |
| **Stretch plan (R9)** | Budget badge switches to the warn variant, and a `--text-sm` line appears under it: `2 nights fewer brings this to ₹58,900.` (interpolated from the engine's closest cheaper variant; omitted if none exists). |
| **Permission-denied** | If storage is blocked, the plan still renders; the S1 banner already warned that a reload will lose it. No second banner here. |
| **Offline** | No change. |

**Interactions & keyboard path.**
Skip link → AppBar `Start over` → `Copy as text` → `Answer them` (if present) → relaxation banner action (if present) → Why disclosure summary → alternative card buttons in DOM order → Adjust `Travellers` → Adjust `Total budget` → `Update plan` → footer. The cost table and day blocks contain no interactive elements and are not in the tab order. At 1280 the sticky right column is *after* the left column in the DOM, so keyboard order matches reading order, not visual columns.

---

### S6 — Export dialog · R17

**Purpose & first read.** The text, immediately. The dialog is a delivery mechanism,
not a screen: heading, the text area, then Copy.

**Layout.** Native modal `<dialog>`, max-width 560px, `--space-6` padding. At 360 it is
`calc(100vw - var(--space-4) * 2)` wide and the button row becomes two stacked
full-width buttons. The textarea is 12 rows at ≥768 and 10 rows at 360, `--font-mono`,
`--text-sm`, `readonly`, `white-space: pre`, vertical scroll only — the text is never
wrapped or reflowed, because it is going to be pasted somewhere else.

**Content & copy.**
- Dialog heading (`<h2>`, `--text-xl`): `Copy your trip`
- Sub-copy (`--text-sm` muted): `Plain text, ready to paste into WhatsApp, Slack or an email.`
- Textarea label (visually hidden): `Your trip as plain text`
- Buttons: primary `Copy` · ghost `Close`
- Live region (`role="status"`, inside the dialog): `Copied` on success.
- The exact text content (R17 requires destination, dates, party total and one line per day):

```
Kochi & Varkala — 5 nights
Sat 10 – Thu 15 Oct 2026 · 2 travellers · from Bengaluru
Total ₹51,600 for 2 (₹25,800 per person)

Day 1 — Sat 10 Oct: Fly Bengaluru 06:55 → Kochi 08:15 · Check in, Brunton Boatyard · Fort Kochi sunset walk
Day 2 — Sun 11 Oct: Chinese fishing nets at dawn · Mattancherry spice market
Day 3 — Mon 12 Oct: Drive to Varkala · North cliff evening walk
Day 4 — Tue 13 Oct: Kappil backwater kayak · Beach afternoon
Day 5 — Wed 14 Oct: Ayurvedic morning · Varkala cliff sunset
Day 6 — Thu 15 Oct: Check out · Fly Kochi 18:40 → Bengaluru 20:00

Stay: Brunton Boatyard, 5 nights, 1 room
Travel ₹18,800 · Stay ₹21,000 · Experiences ₹6,300 · Local allowance ₹5,500

Plan KOCH-5N-2P-B60-a41c · Compass catalogue 2026-08-01
Prices are indicative sample data. Compass does not sell or reserve anything.
```

**States.**

| State | What renders |
|---|---|
| **Default (open)** | Dialog opens via `showModal()`. Focus moves to the textarea with its content **selected** (`select()`), so Ctrl+C works before the user reaches the button. Background is inert; the backdrop is not click-through. |
| **Success** | `Copy` → clipboard write resolves → live region text becomes `Copied`, the button label changes to `Copied` with a check glyph for 2s then reverts to `Copy`. The dialog stays open — the user may want to re-copy. |
| **Permission-denied / clipboard unavailable** | Danger-subtle inline message under the buttons, `role="alert"`: `We couldn't copy automatically. The text is selected — press Ctrl+C (or Cmd+C) to copy it.` The textarea content is re-selected. The button label reverts to `Copy` immediately. This is the expected path in browsers that deny `navigator.clipboard` on insecure origins, so it must be built, not treated as an edge case. |
| **Empty** | Not reachable — the dialog only opens from a rendered plan. |
| **Loading** | None; the string is built synchronously from the plan already in memory. |
| **Error** | Same as permission-denied; there is no other failure mode. |
| **Offline** | No change — the clipboard is local. |
| **Closed** | Esc, the `Close` button, or a backdrop click closes it and returns focus to the `Copy as text` button on S5. |

**Interactions & keyboard path.**
Focus trap is the platform's (`<dialog>` + `showModal()`). Tab cycle: textarea →
`Copy` → `Close` → back to textarea. Esc closes. The dialog has
`aria-labelledby` pointing at its `<h2>`.

---

## 5. Motion

Motion in Compass is confirmation, never decoration. Six animations exist; there are no
others.

| What | Property | Duration | Easing |
|---|---|---|---|
| Vibe / option card hover | `transform: translateY(-2px)`, `box-shadow` | `--dur-fast` 120ms | `--ease` |
| Card selection → advance on S3 | opacity+`translateX(-8px)` out, `translateX(8px)` in | `--dur-base` 180ms | `--ease` |
| Generating progress bar | `width` 0 → 100% | 800ms | linear |
| Banner / FieldError entry | opacity 0→1, `translateY(-4px)` | `--dur-fast` 120ms | `--ease` |
| Dialog open | backdrop opacity 0→1, panel `scale(0.98)`→`scale(1)` | `--dur-base` 180ms | `--ease` |
| Disclosure expand | `height` auto-animated via `grid-template-rows: 0fr → 1fr` | `--dur-base` 180ms | `--ease` |

**Reduced motion.**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

Plus three behavioural changes that CSS alone cannot deliver:
1. **S3** advances immediately on selection instead of after 180ms.
2. **S4** renders the progress bar at a static 100% fill; the status text still steps
   through its three strings, because that is content, not motion, and it is what makes
   the wait honest.
3. **Nothing auto-scrolls.** Focus moves are done with `element.focus({ preventScroll:
   false })` under normal motion and the browser's instant jump under reduced motion —
   never a smooth-scroll animation.

---

## 6. Accessibility

Target: WCAG 2.1 AA. Every commitment below is testable.

### 6.1 Structure and focus

- One `<h1>` per screen. Section headings are `<h2>`; day headings `<h3>`. No heading level is skipped.
- Landmarks: `<header>` (AppBar), `<main id="main">`, `<footer>` (provenance). The SummaryBar sits inside `<header>`.
- First focusable element on every screen is a visually hidden skip link, `Skip to content`, which becomes visible on focus and targets `#main`.
- On every screen change, focus moves to that screen's `<h1>` (`tabindex="-1"`, outline suppressed only for the programmatic move — the ring still appears on keyboard focus). Exceptions, both deliberate: arriving on S3 via Back focuses the previously chosen option; closing S6 returns focus to `Copy as text`.
- Focus is never trapped except inside the modal `<dialog>`, and never lost to `<body>`.
- Focus ring: `outline: 3px solid var(--color-focus); outline-offset: 2px;` on `:focus-visible`, on **every** interactive element including native inputs, selects and the textarea. Ratios in §2.1.

### 6.2 The primary flow, keyboard only

No mouse, from a cold load to a copied itinerary:

```
Tab               → "Skip to content"
Tab ×2            → Beach card
Enter             → Beach selected (aria-pressed=true), Continue enabled
Tab ×5            → Continue
Enter             → S2; focus lands on "Your trip basics"
Tab               → Start date   (type/arrow the native picker)
Tab               → End date
Tab               → Budget       (type 60000)
Tab               → Travellers
Tab               → Flying from  (arrow keys change the metro)
Tab ×2            → Continue      (Enter in any field also submits)
Enter             → S3 Q1; focus lands on the question heading
Tab               → "Within India"
Enter             → advances to Q2b; focus on its heading
… (repeat for Q2b, Q3, Q4, or Tab to "Plan my trip now" and press Enter at any point)
                  → S4 (no controls, ≤2s) → S5; focus lands on "Kochi & Varkala"
Tab ×2            → "Copy as text"
Enter             → S6 opens, focus in the textarea with all text selected
Tab               → "Copy"
Enter             → "Copied" announced
Esc               → dialog closes, focus back on "Copy as text"
```

### 6.3 Live regions

| Region | Politeness | Announces |
|---|---|---|
| SummaryBar | `role="status"` polite, `aria-atomic="true"` | `5 nights · 2 travellers · from Bengaluru · ₹60,000` on every basics change |
| S2 first FieldError | `role="alert"` | The error string, on failed submit |
| S2 ErrorSummary | `role="alert"` + focus | `2 things to fix before we can plan` |
| S4 status line | `role="status"` polite | Each of the three generating strings |
| S5 plan region | `role="status"` polite, `aria-atomic="true"` | `Plan updated. Gokarna & Om Beach, ₹43,900 total for 4 travellers.` on alternative switch or Adjust apply |
| S5 relaxation | `role="status"` polite | `Showing the international plan. Bangkok, ₹61,400 total.` |
| S6 copy confirmation | `role="status"` polite | `Copied` |
| S6 copy failure | `role="alert"` | `We couldn't copy automatically. The text is selected — press Ctrl+C (or Cmd+C) to copy it.` |
| Start over | `role="status"` polite | `Saved trip cleared.` |

Only one assertive/alert region is ever live at a time. The polite plan region is
`aria-atomic` so a partial update is never read as a fragment.

### 6.4 Labels and names

- Every input has a visible `<label for>`. The only visually hidden labels in the app are the S6 textarea (`Your trip as plain text`) and the skip link.
- Hints and errors are attached with `aria-describedby="hint-x err-x"`, in that order.
- Vibe cards and option buttons carry `aria-pressed`; their accessible name is the label text only — the description is inside the button but marked `aria-hidden="false"` and included, which is acceptable because it is short and it is what a screen-reader user needs to tell "Lively" from "Empty".
- Icons are `aria-hidden="true"` with `focusable="false"`. No icon carries meaning alone.
- The cost table has a `<caption>` (`What makes up your ₹51,600 total`), visually hidden, and `<th scope="row">` per line item.
- **Prohibited accessible names, anywhere in the app (R16):** `Book`, `Booking`, `Pay`, `Checkout`, `Reserve`.

### 6.5 Targets and zoom

- Minimum hit target 44 × 44 CSS px for every control on every width, including the AppBar `Start over` (padded to 44px tall), the disclosure summary, the number steppers and the dialog buttons. Inline links inside prose are exempt per WCAG 2.5.5 (inline exception) but none exist in the primary flow.
- At 320px width with 200% zoom, no content is lost and there is no horizontal scroll; the 360 layout rules cover this since every column is fluid and no element has a fixed px width above 320.
- Text can be resized to 200% without loss of function: all type is in `rem`, and no container has a fixed height that would clip text.

---

## 7. UX acceptance checklist

QA tests these directly against the running UI at `http://localhost:4079`. Each is
observable without reading this document.

| ID | Check | Screen | How to verify |
|---|---|---|---|
| **UX1** | On a first load of `/` at 1280×800 with no saved session, exactly six vibe cards are visible with the labels Mountains, Beach, Party, Honeymoon, Peace & Quiet, Culture & Food, the page does not scroll vertically, and `Continue` is present and disabled with the helper text `Pick a vibe to continue.` below it. | S1 | Load `/`, assert `document.body.scrollHeight <= window.innerHeight`, six cards, `Continue` has the `disabled` attribute, helper text matches exactly. |
| **UX2** | Clicking `Beach` sets that card's `aria-pressed="true"` with a visible accent border and check glyph while all five others read `aria-pressed="false"`, and `Continue` becomes enabled in the same frame; clicking `Mountains` afterwards moves the pressed state so exactly one card is ever pressed. | S1 | Click, assert `aria-pressed` counts (1 true / 5 false) and `Continue` no longer has `disabled`. Repeat with a second card. |
| **UX3** | Every screen that shows a price displays a non-dismissable line containing the word `indicative` and the date `2026-08-01`, and no element anywhere in the app has an accessible name matching `Book`, `Booking`, `Pay`, `Checkout` or `Reserve` (case-insensitive, whole name). | S1, S2, S3, S5, S6 | On each screen, assert the footer text contains both strings and that no close/dismiss control exists on it. Then walk every element's accessible name across the full flow and assert zero matches. |
| **UX4** | On S2 the summary bar reads `5 nights · 2 travellers · from Bengaluru · ₹60,000` on arrival from the defaults, and changing travellers to `4` updates it to `5 nights · 4 travellers · from Bengaluru · ₹60,000` without pressing Continue; the bar has `role="status"`. | S2 | Read the bar on load, type into the travellers field, blur, re-read. Assert `role="status"` on the element. |
| **UX5** | Setting the end date before the start date and clicking `Continue` leaves the screen unchanged, renders the exact string `End date must be after your start date` beneath the end-date field within 100ms, links it via `aria-describedby`, sets `aria-invalid="true"`, colours that field's border `--color-danger`, and moves keyboard focus to the end-date input. | S2 | Set dates, click Continue, assert the S2 `<h1>` is still present, the error text matches exactly, `aria-describedby` on the input contains the error node's id, and `document.activeElement` is the end-date input. |
| **UX6** | Setting budget to `0` **and** travellers to `13` and clicking `Continue` shows an error summary above the heading reading `2 things to fix before we can plan`, moves focus to it, and shows the exact strings `Enter a budget of at least ₹5,000` and `Travellers must be between 1 and 12` inline on their fields; Continue still does not advance. Correcting the budget alone removes only that error and the summary becomes `1 thing to fix before we can plan`. | S2 | Submit invalid, assert summary text, `document.activeElement` is the summary, both inline strings present, still on S2. Fix budget, resubmit, assert the count changes. |
| **UX7** | Every adaptive question render shows a progress line matching `Question \d of \d`, an option labelled exactly `No preference`, a `Back` control and a `Plan my trip now` control — on the first question and on the last. | S3 | Walk the Beach path start to finish; on each question assert all four are present and visible. |
| **UX8** | With vibe = Beach, answering `International` to question 1 produces a next question whose heading contains `long-haul`; restarting and answering `Within India` produces a next question whose heading contains `coast`, and the word `long-haul` never appears anywhere on that branch. Choosing `No preference` on any question advances to a different question rather than staying put. | S3 | Run both branches from a cleared session; assert heading contents and that the long-haul heading is absent on the India branch. Then run a third pass choosing `No preference` on Q1 and assert the question index advances. |
| **UX9** | After answering questions 1–3, pressing `Back` twice shows question 2 with the previously chosen option at `aria-pressed="true"` and keyboard focus on that option; changing it to an option on a different branch replaces question 3's heading with the new branch's question, while the summary bar text is byte-identical to before. | S3 | Record the summary bar text and Q3's heading, go Back twice, assert pressed state and `document.activeElement`, change the answer, assert Q3's heading differs and the summary bar is unchanged. |
| **UX10** | Between the last answer and the plan, a screen appears containing the literal text `Scoring 14 destinations against your answers` inside an element with `role="status"`; it is visible for at least 600ms and is gone within 2000ms of the last answer. | S4 | Timestamp the click on the final answer; poll for the status text; assert first-seen ≥ 0ms, still present at 500ms, and absent by 2000ms. |
| **UX11** | The plan screen renders one destination as its `<h1>`, exactly six day blocks headed `Day 1` … `Day 6` for a 5-night trip, each containing at least one named experience, a stay entry naming the property with `5 nights`, and flight legs on Day 1 and Day 6; at 1280×800 the destination, the total, the budget badge and `Copy as text` are all within the first 800px without scrolling; and when the plan was reached via `Plan my trip now` on question 1 of 4, the hero also shows the text `3 questions answered for you`. | S5 | Assert six `Day N` headings and their contents; assert `getBoundingClientRect().bottom <= 800` for the H1, the total, the badge and the `Copy as text` button. Then re-run taking `Plan my trip now` on question 1 and assert the defaulted-count string is present and matches the number of skipped questions. |
| **UX12** | The budget line reads exactly one of `₹8,400 under your budget`, `On budget`, or `Stretch — N% over your budget`, styled with the success, neutral or warn token pair respectively; and no plan presented as the recommendation for a ₹60,000 budget has a total above ₹75,000. | S5 | Run a case that lands under budget and one that lands over; assert the string form and computed `background-color`/`color` match the token pair. Sweep the recommendation total across several answer sets and assert ≤ budget × 1.25. |
| **UX13** | The cost breakdown shows four line items — Travel, Stay, Experiences, Local allowance — each with a per-unit basis line, and their amounts sum exactly to the displayed party total; the per-person figure equals the total ÷ travellers rounded to the nearest ₹100; changing travellers from 2 to 4 increases the Travel amount by exactly the per-traveller fare × 2. | S5 | Parse the four amounts and the total from the DOM, assert the sum and the per-person arithmetic. Then apply travellers = 4 and assert the Travel delta. |
| **UX14** | `Why this trip` is collapsed on first render (`aria-expanded="false"`); expanding it reveals at least three reasons that each quote one of the user's own answers, and at least one named rejected destination whose reason contains a number. | S5 | Assert the collapsed state, click, assert `aria-expanded="true"`, count list items under `Because you said` ≥ 3, and match `/\d/` in at least one item under `Considered and rejected`. |
| **UX15** | The alternatives section shows a Saver card at least 10% below the recommendation and/or a Stretch card above it but within budget × 1.25, each with a destination, a total, a delta and a `Use this plan` button; where a slot has no qualifying option, the literal sentence `No cheaper option in this catalogue for these dates` (or `No pricier option that still stays inside your stretch band`) is rendered in its place, and the slot is never an empty box. | S5 | Assert card contents and the price relationships. Then run an answer set with no Saver and assert the exact sentence is present and the container has non-empty text. |
| **UX16** | Choosing `Use this plan` on the Saver card updates the destination heading, the total, every cost line item, the budget line and the plan ID together, and announces the change in a `role="status"` region as `Plan updated. …`; the previous recommendation appears as a card that switches back. | S5 | Record heading/total/plan ID, click, assert all four changed, assert the live region text starts with `Plan updated.`, then click the `Recommended` card and assert the original values return. |
| **UX17** | Setting travellers to `4` in the adjust panel and pressing `Update plan` re-renders the plan in place with a new total, a new per-person figure and a different plan ID, without any question screen or generating screen appearing, and with the summary bar's vibe and departure city unchanged; `Update plan` is disabled until a value actually differs. | S5 | Assert the button is disabled on load, change the value, assert enabled, apply, then assert the plan ID changed, the S3/S4 markers never appeared, and the summary bar's vibe substring is identical. |
| **UX18** | For answers with no exact match (International + Party + 2 nights + ₹25,000 for 4), a plan is still rendered and a banner above it names the dropped constraint in a sentence containing both the original constraint and the substitute; the banner offers a control that, when pressed, replaces the banner with a sentence containing the resulting cost in rupees; the banner has no dismiss control. | S5 | Enter those answers, assert a destination and a total exist, assert the banner text, click `Put international back`, assert the new text matches `/₹[\d,]+/`, assert no close button exists on the banner. |
| **UX19** | `Copy as text` opens a modal dialog whose heading is `Copy your trip`, moves focus into a `readonly` textarea whose text contains the destination, the date range, the party total and one line per day (six `Day N` lines for a 5-night trip); pressing `Copy` puts a `Copied` message in a `role="status"` region; pressing Esc closes the dialog and returns focus to `Copy as text`. If the clipboard is unavailable, the message `We couldn't copy automatically. The text is selected — press Ctrl+C (or Cmd+C) to copy it.` appears instead and the dialog stays open. | S6 | Open, assert `document.activeElement` is the textarea and it has `readonly`, assert the content lines, click Copy, assert the status text, press Esc, assert focus returned. Then deny clipboard permission and assert the fallback string. |
| **UX20** | Reloading the browser mid-questionnaire (after basics and two adaptive answers) returns to the same question with all prior answers intact and the summary bar unchanged; reloading on a rendered plan shows the identical plan ID and total without passing through the generating screen; on returning to `/` with a saved session, a banner headed `You have a trip in progress` appears, and its `Start over` control clears the session and leaves the six vibe cards with none pressed. | S1, S3, S5 | Reload at both points and diff the visible text; navigate to `/`, assert the banner, click `Start over`, assert no card has `aria-pressed="true"` and a further reload shows no banner. |
| **UX21** | At 360px there is no horizontal scrollbar on any screen, the vibe grid is one column, the plan screen is a single column with the cost breakdown above the itinerary, and the primary action sits in a sticky bottom bar; at 768px the vibe grid is two columns, the plan is a single column, and the summary bar keeps all four facts without an ellipsis. At 1280px the plan is two columns with the cost breakdown in a sticky right column. | All | Set each viewport, walk the flow, assert `document.documentElement.scrollWidth <= clientWidth`, assert the computed `grid-template-columns` column counts and the DOM/visual order of the breakdown vs the itinerary, and assert `text-overflow` is not `ellipsis` on the summary bar. |
| **UX22** | Every interactive element shows a visible focus ring of 3px in `--color-focus` with a 2px offset when reached by Tab, every control's bounding box is at least 44 × 44 px at all three widths, and the whole primary flow — `/` to a copied itinerary — is completable with the keyboard alone, with focus landing on the new `<h1>` after each screen change. | All | Tab through each screen asserting `outline-width: 3px` on `:focus-visible` and `rect.width >= 44 && rect.height >= 44`; run the §6.2 key sequence end to end with no mouse events and assert `document.activeElement.tagName` is `H1` after each transition. |
| **UX23** | With `prefers-reduced-motion: reduce` emulated, no element animates position or scale anywhere in the flow — selecting an answer on S3 advances immediately with no slide, the generating progress bar is static, and the dialog appears without a scale transition — while the generating status text still steps through its three strings. | S3, S4, S6 | Emulate the media feature, assert computed `transition-duration` ≤ 0.001s on cards, banners and the dialog, and assert the S4 status text still changes at least once. |
| **UX24** | With the network disabled after the initial load, the entire flow from vibe to copied itinerary completes with no error UI, no failed request in the network log and zero console errors. | All | Load, go offline, run the primary flow, assert no `console.error`, no failed requests, and that the plan renders. |

**Traceability.** R1 → UX1, UX2. R2 → UX4. R3 → UX5, UX6. R4 → UX7, UX8. R5 → UX7,
UX11. R6 → UX9. R7 → UX10, UX11. R8 → UX13. R9 → UX12. R10 → UX14. R11 → UX15, UX16.
R12 → UX17. R13 → UX16, UX17, UX20. R14 → UX18. R15 → UX20. R16 → UX3. R17 → UX19.
Cross-cutting: UX21 (reflow), UX22 (a11y), UX23 (motion), UX24 (offline).
