# Mobile Responsive Design — Spec

## Goal

Make all 5 pages of CaléPlan usable on smartphone browsers (≥ 375px wide) by adding a single responsive breakpoint at `md:` (768px). Below that threshold = mobile experience; above = existing desktop experience, unchanged.

## Breakpoint Strategy

**Single breakpoint: `md:` (768px)**  
No intermediate tablet breakpoint. Screens ≥ 768px get the full desktop layout. Screens < 768px get the mobile layout described below.

---

## Page 1 — Landing Page (`/`)

**Effort: Low**

### Problem
The navigation bar overflows on small screens: logo + 3 nav links + "Connexion" + "Commencer gratuitement" all on one line.

### Solution
- Mobile nav: logo + "Connexion" button only. Hide the anchor links ("Fonctions", "Tarifs") on mobile — they're in-page scroll anchors and not critical.
- Hero CTA button: `w-full` on mobile.
- Pricing grid and Features grid are already responsive (`sm:` classes) — no change needed.

---

## Page 2 — Auth (`/auth`)

**Effort: Low**

### Problem
- `h-screen overflow-hidden` cuts off the form when the virtual keyboard opens.
- `p-9` padding is too large on 375px screens.

### Solution
- Replace `h-screen overflow-hidden` with `min-h-screen` on the container — allows the page to scroll if the keyboard reduces visible area.
- Responsive padding: `p-6 md:p-9`.
- The left-side brand panel is already hidden on mobile (existing `hidden md:flex`) — no change.

---

## Page 3 — Dashboard (`/dashboard`)

**Effort: Medium**

### Problem
- Topbar: logo + 240px search bar + view toggle + dark-mode icon + avatar → all overflow on mobile.
- List view: 5 fixed-width columns overflow horizontally.
- No FAB for "New project" — the button is small inside the topbar.

### Solution

**Topbar (mobile):**
- Row 1: logo (left) + avatar (right)
- Row 2 (collapsible): search input full-width, appears when search icon is tapped
- View toggle (grid/list) and dark-mode icon moved to row 2 or hidden — dark mode icon kept, view toggle kept as icon-only

**List view (mobile):**
- Simplify to 3 columns: thumbnail · project name · delete button
- Force grid view as the default view on mobile (the card layout already works well)

**FAB:**
- Fixed "+" button, bottom-right corner, `z-50`, `fixed bottom-6 right-6`, orange brand color
- Replaces the topbar "+ Nouveau" button on mobile

---

## Page 4 — Account (`/account`)

**Effort: Low**

### Problem
The page is already centered and narrow — works fine on mobile natively.

### Solution
Minor adjustments only:
- Reduce horizontal padding on mobile: `px-4 md:px-8`
- Logout button: `w-full` on mobile

---

## Page 5 — Project Editor (`/project/[id]`)

**Effort: High**

The editor has 3 tabs: Plan 2D, Calepinage (tiling), Quantitatif (quantities).

### Tab A — Plan 2D

**Problem:** The drawing canvas has no touch support, and the drawing toolbar is keyboard/mouse-oriented.

**Solution (Option A — read-only mobile):**
- Touch pan + pinch-to-zoom on the canvas (view only, no drawing)
- Drawing toolbar hidden on mobile (`hidden md:flex`)
- Informational banner on mobile: "La création de plans est disponible sur ordinateur ou tablette"
- This keeps the canvas useful (clients can view progress) without the complexity of a full touch drawing API

### Tab B — Calepinage (Tiling)

**Problem:** The sidebar (`w-[320px]` aside) is fixed width and impossible to use on mobile — it takes half the screen or overflows.

**Solution (Option B — internal tabs):**
- On mobile: replace the side-by-side layout with two internal tabs: "Aperçu" (canvas) and "Réglages" (controls)
- The active tab occupies the full width of the screen
- Default tab: "Aperçu"
- On desktop: the existing `aside w-[320px]` layout is unchanged
- Touch pinch-to-zoom on the tiling preview canvas

### Tab C — Quantitatif (Quantities)

**Problem:** The quantities table has many columns and overflows on narrow screens.

**Solution:**
- Wrap the table in `overflow-x-auto` — horizontal scroll on mobile
- Add a summary section at the top: key totals (surface, tiles needed, cost) displayed as stacked summary cards on mobile

---

## Viewport Meta Tag

**Critical missing piece:** `src/app/layout.tsx` has no viewport meta tag. Without it, mobile browsers apply a default 980px viewport width, making all responsive classes ineffective.

Add to `layout.tsx`:
```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};
```
This requires importing `Viewport` from `'next/navigation'` — in Next.js 14 App Router, viewport is exported separately from metadata.

---

## Out of Scope

- No tablet-specific breakpoint (md: is sufficient)
- No touch drawing on Plan 2D (deferred to a later sprint)
- No PWA / offline mode
- No native app wrapper
- No performance optimizations beyond layout fixes

---

## Testing Approach

Each page change is verifiable with browser DevTools device emulation at 375px width (iPhone SE) and 390px width (iPhone 14).

Key assertions per page:
1. Landing: nav does not overflow, CTA is full-width
2. Auth: form is fully visible when keyboard is open, no clipping
3. Dashboard: topbar fits in one row, list view has 3 columns, FAB visible
4. Account: logout button is full-width
5. Editor — Plan: toolbar hidden, banner visible, canvas pannable
6. Editor — Tiling: Aperçu/Réglages tabs present, sidebar hidden
7. Editor — Quantities: table scrolls horizontally, summary cards visible
