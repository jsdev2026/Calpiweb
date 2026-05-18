# Mobile Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 5 pages of CaléPlan usable on smartphones (≥ 375px) with a single `md:` (768px) breakpoint.

**Architecture:** Pure CSS + Tailwind responsive classes for simple pages. State-driven layout switching (mobile tabs) for the tiling editor. Touch overlay for plan editor pan/zoom. No new routes, no new stores.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS (`md:` breakpoint), React hooks (`useState`, `useRef`, `useEffect`), TypeScript.

---

## File Map

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add `viewport` export |
| `src/app/page.tsx` | Simplify nav, full-width hero CTA |
| `src/app/auth/page.tsx` | `min-h-screen`, `p-6 md:p-9` |
| `src/app/dashboard/page.tsx` | 2-row topbar on mobile, simplified list, FAB |
| `src/app/account/page.tsx` | Reduced padding, full-width logout btn |
| `src/components/plan/PlanEditor.tsx` | Mobile banner + touch pan/pinch overlay |
| `src/components/plan/PlanToolbar.tsx` | `hidden md:flex` wrapper |
| `src/components/tiling/TilingEditor.tsx` | Mobile tabs (Aperçu / Réglages) |
| `src/components/quantities/QuantitiesPanel.tsx` | `overflow-x-auto` + mobile summary cards |

---

## Task 1: Viewport meta tag

**Files:**
- Modify: `src/app/layout.tsx`

Without a viewport meta tag, mobile browsers apply a 980px default width and responsive Tailwind classes have no effect.

- [ ] **Step 1: Add `viewport` export**

Replace the `layout.tsx` content:

```tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk, DM_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'CaléPlan — Calepinage professionnel',
  description: 'Application de calepinage carrelage pour professionnels du bâtiment',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${spaceGrotesk.variable} ${dmSans.variable}`}>
      <head>
        {/* Prevent dark-mode flash before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('caleplan_dark')==='true')document.documentElement.setAttribute('data-dark','true');}catch(e){}})();` }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```
Expected: all 39 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(mobile): add viewport meta tag"
```

---

## Task 2: Landing page nav

**Files:**
- Modify: `src/app/page.tsx`

On mobile, the nav bar overflows because it contains logo + anchor links + "Connexion" + "Commencer gratuitement". Fix: hide anchor links and the "Commencer gratuitement" nav button on mobile; make the hero CTA full-width on mobile.

- [ ] **Step 1: Update the nav**

In `src/app/page.tsx`, replace the `<nav>` element (line 20–24):

```tsx
<nav className="flex items-center gap-3">
  <a href="#tarifs" className="hidden md:block text-[13.5px]" style={{ color: 'var(--text2)' }}>Tarifs</a>
  <Link href="/auth" className="text-[13.5px] font-medium" style={{ color: 'var(--text2)' }}>Connexion</Link>
  <Link href="/auth" className="btn-primary hidden md:flex text-[13px] px-4 py-2">Commencer gratuitement</Link>
</nav>
```

- [ ] **Step 2: Make hero CTA full-width on mobile**

Replace the hero CTA `<div>` (line 38–43):

```tsx
<div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
  <Link href="/auth" className="btn-primary px-7 py-3 text-[15px] text-center">Commencer gratuitement</Link>
  <a href="#fonctions" className="rounded-xl border px-7 py-3 text-[15px] font-medium text-center transition-colors" style={{ borderColor: 'var(--bdr)', color: 'var(--text2)', background: 'var(--surf)' }}>
    Voir les fonctions
  </a>
</div>
```

- [ ] **Step 3: TypeScript + tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(mobile): simplify landing nav and hero CTA on mobile"
```

---

## Task 3: Auth page

**Files:**
- Modify: `src/app/auth/page.tsx`

Two problems on mobile: `h-screen overflow-hidden` clips the form when the virtual keyboard opens; `p-9` on the cards is too much padding on 375px screens.

- [ ] **Step 1: Fix container height**

In `src/app/auth/page.tsx` line 122, replace:

```tsx
<div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
```

with:

```tsx
<div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
```

- [ ] **Step 2: Fix card padding — 3 cards**

Three cards in the file all have `p-9`. Replace each with `p-6 md:p-9`.

Login card (line 127):
```tsx
<div className="w-full max-w-[420px] rounded-[var(--rl)] border p-6 md:p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
```

Register card (line 156):
```tsx
<div className="w-full max-w-[420px] rounded-[var(--rl)] border p-6 md:p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
```

Forgot card (line 188):
```tsx
<div className="w-full max-w-[420px] rounded-[var(--rl)] border p-6 md:p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
```

- [ ] **Step 3: TypeScript + tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/page.tsx
git commit -m "feat(mobile): fix auth page scroll and padding on mobile"
```

---

## Task 4: Dashboard — topbar, list view, FAB

**Files:**
- Modify: `src/app/dashboard/page.tsx`

Three problems: topbar overflows on mobile; list view has 5 fixed columns that overflow; no FAB for new project.

**Approach:**
- Add `searchOpen: boolean` state for the mobile search row.
- Replace `shell-topbar` header with a flex-wrap version: row 1 is always visible (logo + icon row), row 2 is the expanded search (mobile only).
- List view: hide the status + date columns on mobile, using responsive classes inside `ProjectRow`.
- Grid always shows on mobile; list shows only on desktop when selected.
- FAB: fixed `+` button, `md:hidden`.

- [ ] **Step 1: Add `searchOpen` state**

In `DashboardPage`, after the existing state declarations (around line 434), add:

```tsx
const [searchOpen, setSearchOpen] = useState(false);
```

- [ ] **Step 2: Replace the `<header>` block**

Replace the entire `<header>` element (lines 503–593) with:

```tsx
{/* Topbar */}
<header className="sticky top-0 z-30 flex flex-wrap items-center border-b px-4 md:px-6"
  style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', minHeight: 'var(--topbar)' }}>

  {/* Row 1 */}
  <div className="flex h-[var(--topbar)] w-full items-center md:contents">
    {/* Logo */}
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--accent)' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white"/>
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
          <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white"/>
        </svg>
      </div>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>CaléPlan</span>
    </div>

    {/* Desktop: separator + search */}
    <div className="mx-4 hidden h-5 w-px md:block" style={{ background: 'var(--bdr)' }} />
    <div className="relative hidden md:block">
      <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un projet…"
        style={{ width: 240, paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 'var(--rs)', fontSize: 13, color: 'var(--text)', outline: 'none' }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }}
      />
    </div>

    {/* Right controls */}
    <div className="ml-auto flex items-center gap-2">
      {/* Search toggle — mobile only */}
      <button type="button" onClick={() => setSearchOpen((v) => !v)} className="btn-icon md:hidden" aria-label="Rechercher">
        <Search size={15} />
      </button>

      {/* View toggle — desktop only */}
      <div className="hidden md:flex rounded-[var(--rs)] p-0.5" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
        <button type="button" onClick={() => setViewMode('grid')} className="flex h-6 w-6 items-center justify-center rounded transition-colors"
          style={viewMode === 'grid' ? { background: 'var(--surf)', color: 'var(--accent)', boxShadow: 'var(--sh)' } : { color: 'var(--muted)' }}>
          <LayoutGrid size={13} />
        </button>
        <button type="button" onClick={() => setViewMode('list')} className="flex h-6 w-6 items-center justify-center rounded transition-colors"
          style={viewMode === 'list' ? { background: 'var(--surf)', color: 'var(--accent)', boxShadow: 'var(--sh)' } : { color: 'var(--muted)' }}>
          <List size={13} />
        </button>
      </div>

      {/* Dark mode toggle */}
      <button type="button" onClick={toggleDarkMode} className="btn-icon" aria-label="Basculer le thème">
        {darkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* User avatar + menu */}
      <div className="relative" ref={userMenuRef}>
        <button type="button"
          onClick={() => setShowUserMenu((v) => !v)}
          className="flex items-center gap-2.5 rounded-[var(--rs)] px-2.5 py-1.5 transition-colors"
          style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials}</div>
          <span className="hidden sm:block" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{user?.name ?? 'Utilisateur'}</span>
          {user?.plan && (
            <span className="tag-pro hidden sm:block rounded-full px-2 py-0.5 text-[10px] font-semibold">{planLabel[user.plan]}</span>
          )}
        </button>

        {showUserMenu && (
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl p-1 shadow-xl"
            style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
            <div className="px-3 py-2">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{user?.name ?? 'Utilisateur'}</p>
              <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{user?.email ?? ''}</p>
            </div>
            <div className="my-1 h-px" style={{ background: 'var(--bdr)' }} />
            <button type="button"
              onClick={() => { setShowUserMenu(false); router.push('/account'); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L9 5h4l-3.2 2.4 1.2 3.9L7 9.1 3 11.3l1.2-3.9L1 5h4L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
              Changer de forfait
            </button>
            <button type="button"
              onClick={() => void logout().then(() => router.push('/auth'))}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
              <LogOut size={13} />
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </div>
  </div>

  {/* Row 2: Search expanded (mobile only) */}
  {searchOpen && (
    <div className="w-full pb-2 md:hidden">
      <div className="relative">
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un projet…"
          autoFocus
          style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 'var(--rs)', fontSize: 13, color: 'var(--text)', outline: 'none' }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }}
        />
      </div>
    </div>
  )}
</header>
```

- [ ] **Step 3: Update view rendering — grid always on mobile**

Replace the grid+list rendering section (lines 648–712) with:

```tsx
{/* Grid view — always on mobile, toggled on desktop */}
<div className={viewMode === 'list' ? 'block md:hidden' : 'block'}>
  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
    {filtered.map((p) => (
      <ProjectCard
        key={p.id}
        project={p}
        onOpen={() => handleOpen(p)}
        onDelete={() => { if (confirm('Supprimer ce projet ?')) void removeProject(p.id); }}
        onSettings={() => { setActive(p.id); setSettingsProjectId(p.id); }}
      />
    ))}
    {/* New project card — hidden on mobile (FAB is used instead) */}
    <button
      type="button"
      onClick={() => setShowNewModal(true)}
      className="group hidden md:flex flex-col items-center justify-center gap-3 rounded-[var(--r)] border-2 border-dashed transition-all"
      style={{ minHeight: 200, borderColor: 'var(--bdr2)', color: 'var(--muted)', cursor: 'pointer', background: 'transparent' }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-l)'; el.style.color = 'var(--accent)'; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--bdr2)'; el.style.background = 'transparent'; el.style.color = 'var(--muted)'; }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--surf3)' }}>
        <Plus size={22} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Nouveau projet</span>
    </button>
  </div>
</div>

{/* List view — desktop only */}
{viewMode === 'list' && (
  <div className="hidden md:flex flex-col gap-2">
    <div className="grid grid-cols-[48px_1fr_120px_140px_32px] items-center gap-4 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
      <span />
      <span>Projet</span>
      <span className="text-center">Statut</span>
      <span className="text-right">Modifié</span>
      <span />
    </div>
    {filtered.map((p) => (
      <ProjectRow
        key={p.id}
        project={p}
        onOpen={() => handleOpen(p)}
        onDelete={() => { if (confirm('Supprimer ce projet ?')) void removeProject(p.id); }}
        onSettings={() => { setActive(p.id); setSettingsProjectId(p.id); }}
      />
    ))}
    <button
      type="button"
      onClick={() => setShowNewModal(true)}
      className="flex items-center gap-3 rounded-[var(--rs)] border-2 border-dashed px-4 py-3 transition-all"
      style={{ borderColor: 'var(--bdr2)', color: 'var(--muted)', cursor: 'pointer', background: 'transparent' }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)'; el.style.background = 'var(--accent-l)'; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--bdr2)'; el.style.color = 'var(--muted)'; el.style.background = 'transparent'; }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: 'var(--surf3)' }}>
        <Plus size={16} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Nouveau projet</span>
    </button>
  </div>
)}
```

- [ ] **Step 4: Add FAB (fixed action button)**

Inside the `DashboardPage` return, before the `{showNewModal && ...}` block, add:

```tsx
{/* FAB — mobile only */}
<button
  type="button"
  onClick={() => setShowNewModal(true)}
  className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl md:hidden"
  style={{ background: 'var(--accent)', color: '#fff' }}
  aria-label="Nouveau projet"
>
  <Plus size={26} />
</button>
```

- [ ] **Step 5: TypeScript + tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: no errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(mobile): dashboard responsive topbar, grid-only mobile view, FAB"
```

---

## Task 5: Account page

**Files:**
- Modify: `src/app/account/page.tsx`

Minor adjustments: reduced horizontal padding on mobile, full-width logout button.

- [ ] **Step 1: Reduce main padding**

Line 30, replace:
```tsx
<main className="mx-auto w-full max-w-lg px-6 py-12">
```
with:
```tsx
<main className="mx-auto w-full max-w-lg px-4 md:px-6 py-12">
```

- [ ] **Step 2: Full-width logout button**

In the "Session" section (around line 76), replace the logout button className:
```tsx
<button type="button" onClick={() => void handleLogout()}
  className="w-full md:w-auto rounded-xl border px-5 py-2.5 text-[13.5px] font-medium transition-colors"
  style={{ borderColor: '#ef4444', color: '#ef4444' }}
  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
  Se déconnecter
</button>
```

- [ ] **Step 3: TypeScript + tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/account/page.tsx
git commit -m "feat(mobile): account page responsive padding and full-width logout"
```

---

## Task 6: Editor — Plan 2D tab (mobile read-only with touch)

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`
- Modify: `src/components/plan/PlanToolbar.tsx`

On mobile: hide the drawing toolbar, show an informational banner, and enable touch pan + pinch-to-zoom via a transparent overlay div that intercepts touch events and translates them to pan/zoom state changes.

The PlanEditor already exposes `scale`, `pan`, `setScale`, `setPan`, and `svgRef` as local state (lines 207–251). The touch overlay sits inside the editor container and calls those same setters.

- [ ] **Step 1: Hide PlanToolbar on mobile**

In `src/components/plan/PlanToolbar.tsx`, wrap the outer `<div>` with `hidden md:flex`:

Replace:
```tsx
  <div
    className="absolute left-4 top-4 z-10 flex flex-col gap-1.5 overflow-y-auto rounded-2xl p-2 shadow-2xl backdrop-blur-md"
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: 'calc(100vh - 120px)', scrollbarWidth: 'none' }}>
```

with:
```tsx
  <div
    className="absolute left-4 top-4 z-10 hidden md:flex flex-col gap-1.5 overflow-y-auto rounded-2xl p-2 shadow-2xl backdrop-blur-md"
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: 'calc(100vh - 120px)', scrollbarWidth: 'none' }}>
```

- [ ] **Step 2: Add touch refs to PlanEditor**

In `src/components/plan/PlanEditor.tsx`, after line 251 (`const svgRef = useRef<SVGSVGElement | null>(null);`), add:

```tsx
const touchRef = useRef<{ dist: number; midX: number; midY: number; panX: number; panY: number } | null>(null);
```

- [ ] **Step 3: Add touch handlers to PlanEditor**

In `src/components/plan/PlanEditor.tsx`, after the `touchRef` declaration, add these three handlers:

```tsx
const handleTouchStart = (e: React.TouchEvent) => {
  e.preventDefault();
  const t = e.touches;
  if (t.length === 2) {
    const dx = t[1]!.clientX - t[0]!.clientX;
    const dy = t[1]!.clientY - t[0]!.clientY;
    touchRef.current = {
      dist: Math.hypot(dx, dy),
      midX: (t[0]!.clientX + t[1]!.clientX) / 2,
      midY: (t[0]!.clientY + t[1]!.clientY) / 2,
      panX: pan.x,
      panY: pan.y,
    };
  } else if (t.length === 1) {
    touchRef.current = { dist: 0, midX: t[0]!.clientX, midY: t[0]!.clientY, panX: pan.x, panY: pan.y };
  }
};

const handleTouchMove = (e: React.TouchEvent) => {
  e.preventDefault();
  const t = e.touches;
  if (!touchRef.current) return;
  if (t.length === 2) {
    const dx = t[1]!.clientX - t[0]!.clientX;
    const dy = t[1]!.clientY - t[0]!.clientY;
    const dist = Math.hypot(dx, dy);
    const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
    const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
    const svg = svgRef.current;
    if (svg && touchRef.current.dist > 0) {
      const ratio = dist / touchRef.current.dist;
      const rect = svg.getBoundingClientRect();
      const mx = midX - rect.left;
      const my = midY - rect.top;
      setScale((s) => {
        const ns = Math.max(0.005, Math.min(s * ratio, 4));
        setPan((p) => ({ x: mx - (mx - p.x) * (ns / s), y: my - (my - p.y) * (ns / s) }));
        return ns;
      });
    }
    touchRef.current = { dist, midX, midY, panX: pan.x, panY: pan.y };
  } else if (t.length === 1) {
    const dx = t[0]!.clientX - touchRef.current.midX;
    const dy = t[0]!.clientY - touchRef.current.midY;
    setPan({ x: touchRef.current.panX + dx, y: touchRef.current.panY + dy });
  }
};

const handleTouchEnd = () => {
  touchRef.current = null;
};
```

- [ ] **Step 4: Add mobile banner + touch overlay in the return**

In `src/components/plan/PlanEditor.tsx`, inside the return `<div>` (line 1252), after the `violationFlash` block and before `<PlanToolbar`, insert:

```tsx
{/* Mobile: info banner */}
<div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center px-4 py-2 md:hidden"
  style={{ background: 'var(--surf)', borderBottom: '1px solid var(--bdr)' }}>
  <p className="text-[12px] font-medium" style={{ color: 'var(--text2)' }}>
    La création de plans est disponible sur ordinateur ou tablette
  </p>
</div>

{/* Mobile: touch overlay for pan + pinch-to-zoom */}
<div
  className="absolute inset-0 z-10 md:hidden"
  style={{ touchAction: 'none' }}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
/>
```

- [ ] **Step 5: TypeScript + tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: no errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat(mobile): plan editor touch pan/pinch and read-only mobile mode"
```

---

## Task 7: Editor — Tiling tab (mobile Aperçu / Réglages tabs)

**Files:**
- Modify: `src/components/tiling/TilingEditor.tsx`
- Create: `src/components/tiling/TilingEditor.test.tsx`

On mobile, the `aside w-80` sidebar is too wide. Replace with two internal tabs: "Aperçu" (canvas full-screen) / "Réglages" (controls full-screen). Desktop layout unchanged.

The mobile tabs are driven by a `mobileTab: 'apercu' | 'reglages'` local state.

- [ ] **Step 1: Write failing test**

Create `src/components/tiling/TilingEditor.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock child components that use canvas/SVG (not needed for tab logic test)
vi.mock('./TilingCanvas', () => ({ TilingCanvas: () => <div data-testid="tiling-canvas" /> }));
vi.mock('./TilingControls', () => ({ TilingControls: () => <div data-testid="tiling-controls" /> }));
vi.mock('@/components/results/ResultsPanel', () => ({ ResultsPanel: () => <div data-testid="results-panel" /> }));
vi.mock('@/engine/tiling/tilingEngine', () => ({
  computeTilingMultiRoom: () => ({ tiles: [], stats: { totalTiles: 0, wholeTiles: 0, cutTiles: 0, reusedTiles: 0, wastePercent: 0, surface: 0, cutGroups: [] } }),
}));
vi.mock('@/engine/geometry/polygon', () => ({ getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 }) }));

// Resize observer not available in jsdom
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

import { TilingEditor } from './TilingEditor';
import type { TilingConfig } from '@/types/tiling';

const config: TilingConfig = {
  layout: 'STRAIGHT', width: 300, height: 300, joint: 3,
  angle: 0, offsetX: 0, offsetY: 0,
};

describe('TilingEditor mobile tabs', () => {
  it('renders Aperçu and Réglages tab buttons on mobile', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    expect(screen.getByRole('button', { name: /Aperçu/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Réglages/i })).toBeDefined();
  });

  it('starts on Aperçu tab (canvas visible, controls hidden)', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    const aperçuBtn = screen.getByRole('button', { name: /Aperçu/i });
    // Aperçu is active by default — button has aria-selected or data-active
    expect(aperçuBtn.getAttribute('data-active')).toBe('true');
  });

  it('switches to Réglages tab on click', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    const reglagesBtn = screen.getByRole('button', { name: /Réglages/i });
    fireEvent.click(reglagesBtn);
    expect(reglagesBtn.getAttribute('data-active')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/tiling/TilingEditor.test.tsx
```
Expected: FAIL — "getByRole 'button' {name: /Aperçu/}" not found, because mobile tabs don't exist yet.

- [ ] **Step 3: Add `mobileTab` state and touch refs to TilingEditor**

In `src/components/tiling/TilingEditor.tsx`, after the existing `const svgRef = useRef...` (line 27), add:

```tsx
  const [mobileTab, setMobileTab] = useState<'apercu' | 'reglages'>('apercu');
  const tilingTouchRef = useRef<{ dist: number; midX: number; midY: number; panX: number; panY: number } | null>(null);

  const handleTilingTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches;
    if (t.length === 2) {
      tilingTouchRef.current = {
        dist: Math.hypot(t[1]!.clientX - t[0]!.clientX, t[1]!.clientY - t[0]!.clientY),
        midX: (t[0]!.clientX + t[1]!.clientX) / 2,
        midY: (t[0]!.clientY + t[1]!.clientY) / 2,
        panX: pan.x, panY: pan.y,
      };
    } else if (t.length === 1) {
      tilingTouchRef.current = { dist: 0, midX: t[0]!.clientX, midY: t[0]!.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleTilingTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches;
    if (!tilingTouchRef.current) return;
    if (t.length === 2) {
      const dist = Math.hypot(t[1]!.clientX - t[0]!.clientX, t[1]!.clientY - t[0]!.clientY);
      const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
      const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
      const svg = svgRef.current;
      if (svg && tilingTouchRef.current.dist > 0) {
        const ratio = dist / tilingTouchRef.current.dist;
        const rect = svg.getBoundingClientRect();
        setScale((s) => {
          const ns = Math.max(0.005, Math.min(s * ratio, 4));
          setPan((p) => ({
            x: (midX - rect.left) - ((midX - rect.left) - p.x) * (ns / s),
            y: (midY - rect.top) - ((midY - rect.top) - p.y) * (ns / s),
          }));
          return ns;
        });
      }
      tilingTouchRef.current = { dist, midX, midY, panX: pan.x, panY: pan.y };
    } else if (t.length === 1) {
      const dx = t[0]!.clientX - tilingTouchRef.current.midX;
      const dy = t[0]!.clientY - tilingTouchRef.current.midY;
      setPan({ x: tilingTouchRef.current.panX + dx, y: tilingTouchRef.current.panY + dy });
    }
  };

  const handleTilingTouchEnd = () => { tilingTouchRef.current = null; };
```

- [ ] **Step 4: Replace the TilingEditor return**

Replace the entire `return (` block (lines 77–148) with:

```tsx
  return (
    <div className="flex flex-1 flex-col overflow-hidden dark:bg-zinc-950 bg-gray-100 md:flex-row">

      {/* Mobile tab bar */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 md:hidden" style={{ background: 'var(--surf)' }}>
        <button
          type="button"
          data-active={mobileTab === 'apercu' ? 'true' : 'false'}
          onClick={() => setMobileTab('apercu')}
          className="flex-1 py-2.5 text-[13px] font-medium transition-colors"
          style={mobileTab === 'apercu'
            ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }
            : { color: 'var(--text2)', borderBottom: '2px solid transparent' }}>
          Aperçu
        </button>
        <button
          type="button"
          data-active={mobileTab === 'reglages' ? 'true' : 'false'}
          onClick={() => setMobileTab('reglages')}
          className="flex-1 py-2.5 text-[13px] font-medium transition-colors"
          style={mobileTab === 'reglages'
            ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }
            : { color: 'var(--text2)', borderBottom: '2px solid transparent' }}>
          Réglages
        </button>
      </div>

      {/* Canvas area — full width on mobile (Aperçu tab), left panel on desktop */}
      <div className={`relative flex flex-1 flex-col border-r border-gray-200 dark:border-zinc-900 ${mobileTab === 'reglages' ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile touch overlay for pan + pinch-to-zoom */}
        <div
          className="absolute inset-0 z-10 md:hidden"
          style={{ touchAction: 'none' }}
          onTouchStart={handleTilingTouchStart}
          onTouchMove={handleTilingTouchMove}
          onTouchEnd={handleTilingTouchEnd}
        />
        <TilingCanvas
          svgRef={svgRef}
          rooms={rooms}
          tiles={tiles}
          config={config}
          scale={scale}
          pan={pan}
          showDimensions={showDimensions}
          wallThickness={wallThickness}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Bottom controls: angle + offsets */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-5 py-3 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowDimensions((v) => !v)}
            title={config.layout !== 'STRAIGHT' || config.angle !== 0 ? 'Cotation disponible uniquement en pose droite à 0°' : 'Afficher / masquer les côtes'}
            disabled={config.layout !== 'STRAIGHT' || config.angle !== 0}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
              showDimensions
                ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
                : 'border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-500 disabled:opacity-30'
            }`}
          >
            <Ruler size={12} /> Côtes
          </button>
          <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Angle</span>
            <input
              type="range" min="0" max="90" step="1"
              value={config.angle}
              onChange={(e) => setConfig({ ...config, angle: parseInt(e.target.value, 10) })}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
            <span className="w-10 font-mono text-xs font-bold text-orange-400">{config.angle}°</span>
          </div>
          <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Décal. X</span>
            <input
              type="range" min="0" max={config.width + config.joint} step="1"
              value={Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetX: parseInt(e.target.value, 10) })}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Décal. Y</span>
            <input
              type="range" min="0" max={config.height + config.joint} step="1"
              value={Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetY: parseInt(e.target.value, 10) })}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Controls sidebar — full width on mobile (Réglages tab), right panel on desktop */}
      <aside className={`z-20 flex w-full flex-col overflow-y-auto dark:bg-zinc-900 bg-white shadow-2xl md:w-80 ${mobileTab === 'apercu' ? 'hidden md:flex' : 'flex'}`}>
        <TilingControls config={config} onChange={setConfig} />
        <ResultsPanel stats={stats} />
      </aside>
    </div>
  );
```

Note: the `useState` call for `mobileTab` must be placed inside the component function body, BEFORE the existing `useState` calls. Move it to after line 23 (the existing `const [scale, setScale] = useState(0.1);` group):

```tsx
  const [mobileTab, setMobileTab] = useState<'apercu' | 'reglages'>('apercu');
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/components/tiling/TilingEditor.test.tsx
```
Expected: PASS — 3 tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```
Expected: all tests pass (39 original + 3 new = 42 total).

- [ ] **Step 7: TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/tiling/TilingEditor.tsx src/components/tiling/TilingEditor.test.tsx
git commit -m "feat(mobile): tiling editor Aperçu/Réglages tabs + touch pan/pinch"
```

---

## Task 8: Editor — Quantities tab (horizontal scroll + summary cards)

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx`

The quantities table has many columns and overflows on narrow screens. Fix: `overflow-x-auto` wrapper. The `StatCard` grid at the top already exists and works on mobile (uses `grid-cols-2 sm:grid-cols-4`). No changes needed there.

The cut table (8 columns) is at line 348 in `QuantitiesPanel.tsx`. It's a `<table>` inside `<div className="overflow-hidden rounded-2xl border...">`. The StatCard grid at line 308 is already `grid-cols-2 sm:grid-cols-4` — responsive, no change needed.

- [ ] **Step 1: Wrap the cut table section in overflow-x-auto**

In `src/components/quantities/QuantitiesPanel.tsx`, find the section at line ~338 that reads:

```tsx
        {/* Cut groups table */}
        <div>
          {result.totalReuseCount > 0 && (
```

Change the outer `<div>` opening (the one wrapping the entire cut groups section) from:
```tsx
        <div>
```
to:
```tsx
        <div className="overflow-x-auto">
```

Then find line ~348:
```tsx
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-sm">
```

Change to:
```tsx
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 min-w-[640px]">
            <table className="w-full text-sm">
```

This sets a minimum width on the table container so columns don't crush, and the outer `overflow-x-auto` allows horizontal scroll on small screens.

- [ ] **Step 2: TypeScript + full tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx
git commit -m "feat(mobile): quantities table horizontal scroll on mobile"
```

---

## Final verification

- [ ] **Run full test suite**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Run type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Run build**

```bash
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Manual smoke test in DevTools**

Open each page with Chrome DevTools → device emulation → iPhone SE (375px width):
1. `/` — nav shows only "Connexion", hero CTA is full-width
2. `/auth` — form visible when virtual keyboard is open, padding comfortable
3. `/dashboard` — topbar fits in one row, FAB visible, tapping "+" opens modal
4. `/account` — logout button is full-width
5. `/project/[id]` Plan tab — toolbar hidden, banner visible, single-finger pan works
6. `/project/[id]` Calepinage tab — "Aperçu" and "Réglages" tabs visible
7. `/project/[id]` Quantitatif tab — table scrolls horizontally
