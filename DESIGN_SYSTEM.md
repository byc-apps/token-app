# CHRIST BYC — Frontend Design System Specification

> **Target Audience**: Developers, UI Engineers, and Technical Leads building or reproducing frontend views for the **CHRIST (Deemed to be University), Bangalore Yeshwanthpur Campus (BYC)** QIP Portal (*"Shaping Future-Ready Graduates: T-Shaped Learning, Academic Rigour and Academic Transformation"*).
>
> **Stack Core**: React 18, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Vite, Recharts 2.x, Google Fonts (*Plus Jakarta Sans* / *Inter*, *JetBrains Mono*).

---

## 1. Colour Tokens & Palette Architecture

The design language reflects institutional academic prestige anchored by the CHRIST University brand identity: deep **CHRIST Navy** (`#1f3864`) paired with an austere **CHRIST Gold** (`#b8963e`), layered atop clean slate neutral backgrounds and functional semantic accents.

### 1.1 Brand & Institutional Colours

| Token Name | Hex Code | Tailwind / CSS Variable | Intended Application |
|---|---|---|---|
| **CHRIST Navy** | `#1f3864` | `var(--color-christ-navy)` / `bg-christ-navy`, `text-christ-navy`, `border-christ-navy` | Main header background, primary CTA buttons, active tab underlines, numbered indicator circles, primary chart series. |
| **CHRIST Gold** | `#b8963e` | `var(--color-christ-gold)` / `border-christ-gold`, `text-christ-gold`, `ring-christ-gold` | Header bottom decorative band (`border-b-4`), button focus rings, category badges, session sub-slot metadata, footer top border. |
| **Deep Midnight Navy** | `#0a2540` | `bg-[#0a2540]` / Recharts `#0A2540` | Recharts primary bar fill, dark gradient endpoints, high-contrast modal headers. |
| **Navy Indigo Accent** | `#1e3a8a` | `bg-blue-900` / Recharts `#1E3A8A` | Alternating chart cells, deep informational banners. |

### 1.2 Neutral Backgrounds & Shell Tones

| Token Name | Hex Code | Tailwind Class | Application |
|---|---|---|---|
| **App Canvas / Page Shell** | `#f8fafc` | `bg-slate-50` | Primary viewport background across all authenticated layouts. |
| **Card Surface** | `#ffffff` | `bg-white` | Cards, panels, modal dialogs, worksheet containers, dropdowns. |
| **Inset Sub-panel** | `#f1f5f9` | `bg-slate-100` | Inactive controls, code/session chips, read-only inputs, table headers. |
| **Dark Inset / Projector Surface** | `#0f172a` | `bg-slate-900` | Modal header backgrounds, Projector Mode canvas, terminal/stat cards. |
| **Overlay Backdrop** | `rgba(15, 23, 42, 0.6)` | `bg-slate-900/60 backdrop-blur-sm` | Modal backdrops, fullscreen loading scrims. |

### 1.3 Border & Divider Tokens

| Token Name | Hex Code | Tailwind Class | Application |
|---|---|---|---|
| **Card / Panel Border** | `#e2e8f0` | `border-slate-200` | Standard card perimeters, widget separators, tab rails. |
| **Input / Interactive Border** | `#cbd5e1` | `border-slate-300` | Text inputs, selects, textareas, unselected radio buttons. |
| **Subtle Divider** | `#f1f5f9` | `border-slate-100` / `divide-slate-100` | Table row dividers, inner card item divisions. |
| **Gold Accent Band** | `#b8963e` | `border-christ-gold` | Top/bottom institutional demarcations. |

### 1.4 Typography & Text Greys

| Token Name | Hex Code | Tailwind Class | Application |
|---|---|---|---|
| **Primary Text (Heading / Body)** | `#0f172a` | `text-slate-900` | Page titles (`h1`, `h2`), card headers, primary data cells. |
| **Secondary Body Text** | `#1e293b` | `text-slate-800` | Worksheet prompts, instructions text, table content. |
| **Muted / Subtitle Text** | `#475569` | `text-slate-600` | Helper text, secondary descriptions, table column headers. |
| **Metadata / Tertiary Grey** | `#64748b` | `text-slate-500` | Timestamps, facilitator labels, session IDs, character counters. |
| **Placeholder / Disabled Text** | `#94a3b8` | `text-slate-400` | Input placeholder text, disabled actions, inactive states. |
| **Light On Dark (Header/Footer)** | `#f1f5f9` / `#cbd5e1` | `text-gray-200` / `text-gray-300` | Text on CHRIST Navy header and footer. |

### 1.5 Semantic State & Status Colours

| State | Palette | Hex Range | Classes & Role Usage |
|---|---|---|---|
| **Success / Completed** | Emerald | `#10b981` (500)<br>`#059669` (600)<br>`#065f46` (800)<br>`#ecfdf5` (50) | `bg-emerald-100 text-emerald-800 border-emerald-300`<br>Submitted status badges, positive feedback bars, completed indicators. |
| **Warning / Draft / Locked** | Amber | `#f59e0b` (500)<br>`#d97706` (600)<br>`#78350f` (900)<br>`#fffbeb` (50) | `bg-amber-100 text-amber-800 border-amber-300`<br>Draft badges, locked activity banner, mandatory feedback notice. |
| **Error / Destructive** | Rose / Red | `#ef4444` (500)<br>`#b91c1c` (700)<br>`#fef2f2` (50) | `bg-red-50 text-red-700 border-red-200`<br>Save error alerts, timer urgent warnings (<3 mins), validation errors. |
| **Informational / Active** | Blue | `#3b82f6` (500)<br>`#1d4ed8` (700)<br>`#eff6ff` (50) | `bg-blue-50 text-blue-700 border-blue-200`<br>Participant Portal chips, active activity rows, selection highlights. |
| **Governance / HoD / Role** | Purple | `#8b5cf6` (500)<br>`#6d28d9` (700)<br>`#faf5ff` (50) | `bg-purple-100 text-purple-800 border-purple-200`<br>HoD role badge, confidential activity badge, Projector button. |

---

## 2. Typography Specification

### 2.1 Font Families

- **Primary Sans-Serif**: `Plus Jakarta Sans`, `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`. Used for all UI headings, body copy, tables, controls, and form elements.
- **Monospace**: `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`. Used for email IDs, session codes (`D1S1`), question IDs (`A1`, `R1`), timestamps, and numerical KPI totals.

### 2.2 Scale, Weights & Hierarchy

| Element | Tailwind Classes | Equivalent Size | Weight | Tracking / Case |
|---|---|---|---|---|
| **Header App Title** | `text-xl font-bold tracking-tight` | `20px` (1.25rem) | 700 (Bold) | `-0.025em` |
| **Page H1 / Hero Title** | `text-2xl sm:text-3xl font-extrabold text-slate-900` | `24px–30px` | 800 (ExtraBold) | `-0.02em` |
| **Card Title / Section H2** | `text-xl sm:text-2xl font-bold text-slate-900` | `20px–24px` | 700 (Bold) | Normal |
| **Session Header H3** | `text-base sm:text-lg font-bold text-slate-900` | `16px–18px` | 700 (Bold) | Normal |
| **Sub-section / Item H4** | `text-sm sm:text-base font-bold text-slate-900` | `14px–16px` | 700 (Bold) | Normal |
| **Standard Body Text** | `text-xs sm:text-sm text-slate-700 leading-relaxed` | `12px–14px` | 400–500 | Normal |
| **Table Cells & Input Text** | `text-xs font-semibold text-slate-800` | `12px` (0.75rem) | 600 (SemiBold) | Normal |
| **Form Labels** | `text-xs font-bold text-slate-700 uppercase tracking-wider` | `12px` (0.75rem) | 700 (Bold) | `+0.05em` |
| **Small-Caps Micro Tags** | `text-[10px] sm:text-[11px] font-bold uppercase tracking-wider` | `10px–11px` | 700–800 | `+0.05em` to `+0.075em` |
| **KPI Stat Values** | `text-2xl sm:text-3xl font-black font-mono` | `24px–30px` | 900 (Black) | Monospace |

---

## 3. Spacing, Radii, Borders & Elevation

### 3.1 Border Radius Scale

- **`rounded-2xl` (`16px`)**: Primary containers, outer cards, view banners, modal shells, session containers.
- **`rounded-xl` (`12px`)**: Sub-panels, stat tiles, activity rows, widget input frames, notification callouts.
- **`rounded-lg` (`8px`)**: Form inputs, select dropdowns, buttons, segmented control buttons, rating square buttons.
- **`rounded-full` (`9999px`)**: Status pills, progress tags, numbered avatar badges, avatar circles.

### 3.2 Spacing & Padding Scale

- **Page Main Padding**: `px-4 sm:px-6 lg:px-8 py-6` to `py-8`.
- **Primary Card Padding**: `p-6 sm:p-7` (standard card) / `p-5` (session header).
- **Sub-item Row Padding**: `p-3.5` to `p-4` (activity rows, matrix rows).
- **Button Padding**: `px-6 py-2` (Primary CTA) / `px-4 py-2` (Standard secondary) / `px-3 py-1.5` (Compact row action).
- **Input Padding**: `p-2.5` to `p-3` (Text input / textarea).

### 3.3 Elevation & Shadows

- `shadow-sm`: Standard cards, table wrappers, inactive buttons (`0 1px 2px 0 rgb(0 0 0 / 0.05)`).
- `shadow-md`: Active primary buttons, sticky top headers, summary callouts.
- `shadow-lg` / `shadow-2xl`: Sticky bottom worksheet action bar, modal dialogs, projector overlay.

---

## 4. Shell & Layout Architecture

```
+-----------------------------------------------------------------------------------+
| HEADER (bg-christ-navy border-b-4 border-christ-gold text-white)                |
| [Logo] HRDC QIP — BYC [Date Badge]              [Nav Pills] [User Role] [SignOut] |
+-----------------------------------------------------------------------------------+
| MAIN CONTENT (bg-slate-50 min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8)   |
|                                                                                   |
|  [Welcome Banner / Context Pill]                                                  |
|  [Tabs Rail: Day 1 | Day 2 | Day 3 | All Days]                                   |
|  [2-Column Grid or Full-Width Activity Container]                                |
|                                                                                   |
+-----------------------------------------------------------------------------------+
| FOOTER (bg-[#1f3864] border-t border-[#b8963e] text-white py-3.5 px-4)           |
| Line 1: (c) 2026 CS-BYC. All rights reserved.                                     |
| Line 2: Ideated and Developed by: Dr Balakrishnan C & Dr Vinay M | CS-BYC         |
+-----------------------------------------------------------------------------------+
```

### 4.1 Layout Shell Rules

- **Root Container**: `<div className="min-h-screen flex flex-col justify-between bg-slate-50">`
- **Main Container**: `<main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">`
- **Activity Worksheet Shell**: `<div className="max-w-5xl mx-auto space-y-6 pb-20">` (provides bottom clearance for fixed action footer).
- **Breakpoints**:
  - `sm:` (640px) — Switches mobile column stacks into inline rows.
  - `md:` (768px) — 2-column session card grids.
  - `lg:` (1024px) — Full desktop navigation and wide-screen matrix widgets.

### 4.2 Footer Rules & Projector Mode

The footer strictly adheres to institutional attribution standards:
- Always pinned to the base of the page.
- Automatically disappears when Projector Mode or native OS Fullscreen is active:
  ```css
  body:has(#projector-mode-view) footer,
  :fullscreen footer {
    display: none !important;
  }
  ```

---

## 5. Component Recipes (Exact Tailwind Class Strings)

### 5.1 Card with Numbered Circle, Title & Upper-Right Tag

Used throughout worksheet prompts, reflection questions, and poll statements.

```tsx
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
  {/* Header Row: Numbered Navy Circle + Title + Right-Aligned Uppercase Tag */}
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-center gap-2.5">
      <span className="w-6 h-6 rounded-full bg-christ-navy text-white text-xs font-bold flex items-center justify-center shrink-0">
        1
      </span>
      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
        Core Curriculum Philosophy
      </h3>
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
      RATING SCALE
    </span>
  </div>

  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-8.5">
    Evaluate the degree of departmental consensus regarding curriculum breadth versus vertical depth.
  </p>
</div>
```

---

### 5.2 Primary, Secondary, and Action Buttons

#### Primary Submit Button (CHRIST Navy + Gold Accent Ring)
```tsx
<button
  type="button"
  className="px-6 py-2 text-xs font-bold text-white bg-christ-navy hover:bg-slate-800 rounded-lg shadow-md transition disabled:opacity-50 ring-1 ring-christ-gold flex items-center gap-2 cursor-pointer"
>
  Submit Response
</button>
```

#### Secondary / Draft Button (Neutral Slate)
```tsx
<button
  type="button"
  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm disabled:opacity-50 cursor-pointer"
>
  Save Draft
</button>
```

#### Green Action / Launch Button (Emerald)
```tsx
<button
  type="button"
  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
>
  <span>Start Worksheet Now</span>
  <span>→</span>
</button>
```

#### Light Blue Utility Button (Participant Navigation)
```tsx
<button
  type="button"
  className="px-3.5 py-2 text-xs font-semibold text-christ-navy bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
>
  <span>🔄</span>
  <span>Refresh Status</span>
</button>
```

---

### 5.3 Form Inputs, Textareas & Selects

#### Text Input
```tsx
<input
  type="text"
  placeholder="Enter programme name (e.g., BSc Computer Science)..."
  className="w-full text-sm font-semibold rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100 shadow-inner outline-none transition"
/>
```

#### Textarea (With Character Limit Footer)
```tsx
<div className="space-y-1">
  <textarea
    rows={4}
    placeholder="Enter your reflection here..."
    className="w-full text-sm rounded-lg border border-slate-300 p-3 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy focus:border-christ-navy transition disabled:bg-slate-100 disabled:text-slate-600 outline-none"
  />
  <div className="flex justify-between items-center text-xs text-slate-500">
    <span>Character limit applies</span>
    <span className="font-mono text-slate-500">120 / 1500</span>
  </div>
</div>
```

#### Dropdown Select
```tsx
<select
  className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100 outline-none"
>
  <option value="">-- Choose Department / Group --</option>
  <option value="computer-science">Computer Science</option>
  <option value="commerce">Commerce</option>
</select>
```

---

### 5.4 Rating Scale & Poll Choice Rows

#### Rating Scale Number Box (Active vs Inactive)
```tsx
{/* Active (Selected) Option */}
<button
  type="button"
  className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg font-bold text-xs flex flex-col items-center justify-center transition border bg-christ-navy text-white border-christ-navy ring-2 ring-christ-gold shadow-sm cursor-pointer"
>
  <span className="text-sm">4</span>
</button>

{/* Inactive Option */}
<button
  type="button"
  className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg font-bold text-xs flex flex-col items-center justify-center transition border bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400 cursor-pointer"
>
  <span className="text-sm">3</span>
</button>
```

#### Poll Item Row
```tsx
{/* Selected Row */}
<label className="flex items-start gap-3 p-3.5 rounded-lg border transition cursor-pointer select-none bg-blue-50/50 border-christ-navy ring-1 ring-christ-navy shadow-sm">
  <input
    type="radio"
    checked
    className="text-christ-navy focus:ring-christ-navy mt-0.5 shrink-0 w-4 h-4"
  />
  <span className="text-sm font-medium text-slate-800 leading-snug">
    Designing formative classroom assessments aligned to Bloom's Higher Orders
  </span>
</label>

{/* Unselected Row */}
<label className="flex items-start gap-3 p-3.5 rounded-lg border transition cursor-pointer select-none bg-white border-slate-200 hover:border-slate-300">
  <input
    type="radio"
    className="text-christ-navy focus:ring-christ-navy mt-0.5 shrink-0 w-4 h-4"
  />
  <span className="text-sm font-medium text-slate-800 leading-snug">
    Formulating course-level threshold concepts in departmental committees
  </span>
</label>
```

---

### 5.5 Navigation Tabs

#### Underline Tabs Rail (Day Selector)
```tsx
<div className="border-b border-slate-200">
  <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-1">
    {/* Active Tab */}
    <button
      type="button"
      className="py-3 px-2 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap border-christ-navy text-christ-navy"
    >
      <span>Day 1 (28 Sept)</span>
      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
        3 Live
      </span>
    </button>

    {/* Inactive Tab */}
    <button
      type="button"
      className="py-3 px-2 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    >
      <span>Day 2 (29 Sept)</span>
    </button>
  </nav>
</div>
```

#### Pill View Tabs (Analytics / Admin Dashboard)
```tsx
<div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex flex-wrap gap-2">
  {/* Active Pill */}
  <button
    type="button"
    className="px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-900 text-white shadow-sm"
  >
    📊 Per-Activity Analysis
  </button>

  {/* Inactive Pill */}
  <button
    type="button"
    className="px-4 py-2 rounded-xl text-xs font-bold transition text-slate-600 hover:text-slate-900 hover:bg-slate-100"
  >
    📋 Session Summary Reports
  </button>
</div>
```

---

### 5.6 Progress Badges

```tsx
{/* 1. Submitted / Complete */}
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
  <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
  Submitted
</span>

{/* 2. Draft Saved / In Progress */}
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
  <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
  Draft Saved
</span>

{/* 3. Not Started / Pending */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
  Not Started
</span>

{/* 4. Locked / Read-Only */}
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
  🔒 Locked
</span>
```

---

### 5.7 Stat Tiles (KPI Cards)

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
  {/* Neutral Metric */}
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <span className="text-xs font-semibold text-slate-500 uppercase">Target Roster</span>
    <div className="text-2xl font-black text-slate-900 mt-1 font-mono">48</div>
    <span className="text-[11px] text-slate-400">Registered faculty</span>
  </div>

  {/* Success Metric */}
  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
    <span className="text-xs font-semibold text-emerald-800 uppercase">Submitted (85%)</span>
    <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">41</div>
    <span className="text-[11px] text-emerald-600">Completed responses</span>
  </div>

  {/* Warning / In-Progress Metric */}
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
    <span className="text-xs font-semibold text-amber-800 uppercase">In Progress / Draft</span>
    <div className="text-2xl font-black text-amber-700 mt-1 font-mono">5</div>
    <span className="text-[11px] text-amber-600">Drafts recorded</span>
  </div>

  {/* Pending Metric */}
  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
    <span className="text-xs font-semibold text-slate-500 uppercase">Not Started</span>
    <div className="text-2xl font-black text-slate-600 mt-1 font-mono">2</div>
    <span className="text-[11px] text-slate-400">Pending</span>
  </div>
</div>
```

---

### 5.8 Data Table Recipe

```tsx
<div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
      <tr>
        <th className="px-4 py-3 w-12 text-center">#</th>
        <th className="px-4 py-3">Faculty Name</th>
        <th className="px-4 py-3">Department</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3 text-right">Last Active</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100 bg-white">
      <tr className="hover:bg-slate-50/80 transition">
        <td className="px-4 py-3 text-center font-mono text-slate-400 font-bold">1</td>
        <td className="px-4 py-3 font-semibold text-slate-900">Dr. Ananya Sharma</td>
        <td className="px-4 py-3 font-mono text-slate-600">Computer Science</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ✓ Submitted
          </span>
        </td>
        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-400">11:42 AM</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

### 5.9 Toast Notifications & Empty States

#### Dismissible Notification Toast
```tsx
<div className="p-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-between gap-3 border border-slate-700 animate-in fade-in duration-200">
  <div className="flex items-center gap-2">
    <span className="text-emerald-400 font-bold text-sm">✓</span>
    <span>Response draft saved successfully at 11:45 AM.</span>
  </div>
  <button type="button" className="text-slate-400 hover:text-white text-xs p-1">
    ✕
  </button>
</div>
```

#### Empty State Container
```tsx
<div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
  <span className="text-2xl block">📂</span>
  <h4 className="text-sm font-bold text-slate-800">No Responses Submitted Yet</h4>
  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
    Participants will appear here in real-time as soon as worksheets are submitted for this department.
  </p>
</div>
```

---

## 6. Chart Styling (Recharts Configuration)

The analytical dashboards leverage **Recharts** with strict theme-aligned variables:

### 6.1 Recharts Palette & Theme Values

```ts
export const RECHARTS_THEME = {
  // Primary Bar Fills
  primaryNavy: '#0A2540',
  indigoNavy: '#1E3A8A',
  christGold: '#B8963E',
  accentPurple: '#4F46E5',

  // Stacked Likert / Performance Series
  stacked: {
    Excellent: '#10B981',         // Emerald-500
    Good: '#3B82F6',              // Blue-500
    Satisfactory: '#F59E0B',      // Amber-500
    NeedsImprovement: '#EF4444',  // Red-500
  },

  // Grid & Axis
  gridStroke: '#E2E8F0',          // Slate-200
  axisTick: {
    fontSize: 11,
    fontWeight: 600,
    fill: '#475569',              // Slate-600
  },
};
```

### 6.2 Standard Vertical Likert Bar Chart Recipe

```tsx
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

<div className="h-64 w-full">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart
      data={data}
      layout="vertical"
      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
    >
      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
      <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
      <YAxis dataKey="id" type="category" tick={{ fontSize: 11, fontWeight: 600, fill: '#475569' }} />
      <Tooltip
        formatter={(val: any) => [`${val} / 5.0`, 'Mean Score']}
        contentStyle={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          fontSize: '12px',
          fontWeight: 600,
        }}
      />
      <Bar dataKey="mean" radius={[0, 6, 6, 0]}>
        {data.map((_, idx) => (
          <Cell key={`cell-${idx}`} fill={idx % 2 === 0 ? '#0A2540' : '#1E3A8A'} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>
```

---

## 7. Print Stylesheet Rules (`@media print`)

The application supports clean export of Department Reports and Academic Session Summaries to PDF and physical A4 printouts. The print engine uses the following exact CSS rules:

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 15mm 12mm 15mm;
  }

  /* 1. Hide all non-printable chrome */
  header,
  nav,
  footer p:not(:first-child),
  .no-print,
  #header-feedback-link,
  #header-signout-btn,
  button,
  input[type="file"],
  .fixed,
  .backdrop-blur-md {
    display: none !important;
  }

  /* 2. Reset canvas and page dimensions */
  body {
    background: white !important;
    color: black !important;
    font-size: 10.5pt;
    margin: 0 !important;
    padding: 0 !important;
  }

  main {
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
  }

  /* 3. Report container normalization */
  .report-sheet {
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    max-width: 100% !important;
    margin: 0 !important;
  }

  /* 4. Page Break Controls */
  .section-break {
    page-break-before: always !important;
    break-before: page !important;
  }

  .avoid-break {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* 5. Convert interactive form fields into static text display */
  input,
  textarea {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    resize: none !important;
  }

  /* 6. Footer print mode: only line 1 visible in small grey text */
  footer {
    background: transparent !important;
    border: none !important;
    padding: 8px 0 !important;
  }
}
```

---

## 8. Copy-Pasteable Implementation Artifacts

### 8.1 Tailwind Theme & CSS Variables Setup (`src/index.css`)

```css
@import "tailwindcss";

@theme {
  --color-christ-navy: #1f3864;
  --color-christ-gold: #b8963e;
}

/* Hide footer in projector mode or fullscreen */
body:has(#projector-mode-view) footer,
:fullscreen footer {
  display: none !important;
}

/* Print utilities */
@layer utilities {
  .no-print {
    @media print {
      display: none !important;
    }
  }
}
```

---

### 8.2 Component 1: `Header.tsx` (Top Navigation Shell)

```tsx
import React from 'react';

export interface HeaderUser {
  name: string;
  email: string;
  department: string;
  role: 'participant' | 'hod' | 'coordinator' | 'resource_person' | 'admin';
  adminType?: 'app_admin' | 'dean' | 'associate_dean' | 'hrdc' | null;
}

interface HeaderProps {
  user?: HeaderUser | null;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onSignOut }) => {
  return (
    <header className="bg-christ-navy text-white shadow-md border-b-4 border-christ-gold no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo and Titles */}
        <div className="flex items-center gap-3 text-center md:text-left">
          <img
            src="/christ-logo.png"
            alt="CHRIST Logo"
            className="w-10 h-10 object-contain drop-shadow shrink-0"
          />
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h1 className="text-xl font-bold tracking-tight">HRDC QIP — BYC</h1>
              <span className="text-xs uppercase tracking-wider text-christ-gold font-medium bg-black/25 px-2 py-0.5 rounded">
                28–30 Sept 2026
              </span>
            </div>
            <p className="text-xs text-gray-300 hidden sm:block">
              Shaping Future-Ready Graduates: T-Shaped Learning, Academic Rigour and Transformation
            </p>
          </div>
        </div>

        {/* User Status and Navigation */}
        {user && (
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 text-xs font-semibold">
              <a
                href="/participant"
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition"
              >
                My Activities
              </a>
              <a
                href="/feedback"
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition border border-amber-400/30 font-bold"
              >
                📝 Feedback
              </a>
            </nav>

            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold flex items-center gap-2 justify-end">
                {user.name}
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded border border-blue-200">
                  {user.role.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-gray-300">
                {user.email} • <span className="font-mono text-christ-gold">{user.department}</span>
              </div>
            </div>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded transition border border-white/20 shadow-sm cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
```

---

### 8.3 Component 2: `Footer.tsx` (Attribution & Print Compliant)

```tsx
import React, { useState, useEffect } from 'react';

export const Footer: React.FC = () => {
  const [isProjectorActive, setIsProjectorActive] = useState<boolean>(false);

  useEffect(() => {
    const checkProjector = () => {
      const hasProjector = Boolean(document.getElementById('projector-mode-view'));
      const isFullscreen = Boolean(document.fullscreenElement);
      setIsProjectorActive(hasProjector || isFullscreen);
    };

    checkProjector();
    const interval = setInterval(checkProjector, 500);
    document.addEventListener('fullscreenchange', checkProjector);

    return () => {
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', checkProjector);
    };
  }, []);

  if (isProjectorActive) return null;

  return (
    <footer
      role="contentinfo"
      className="bg-[#1f3864] text-white border-t border-[#b8963e] py-3.5 px-4 w-full shrink-0 print:bg-transparent print:border-none print:py-2"
    >
      <div className="max-w-7xl mx-auto text-center space-y-1">
        <p className="text-[12px] sm:text-[13px] text-gray-200 print:text-[10px] print:text-gray-500 font-normal leading-tight">
          © 2026 CS-BYC. All rights reserved.
        </p>
        <p className="text-[12px] sm:text-[13px] text-gray-300 print:hidden font-normal leading-tight">
          Ideated and Developed by: Dr Balakrishnan C & Dr Vinay M | CS-BYC
        </p>
        <p className="text-[11px] sm:text-[12px] text-gray-300/90 print:hidden font-normal leading-tight">
          Built with Google Antigravity IDE v2.4.5 · Powered by Gemini 3.8 Flash & Claude 3.7 Sonnet
        </p>
      </div>
    </footer>
  );
};
```

---

### 8.4 Component 3: `NumberedCard.tsx` (Core Item Container)

```tsx
import React from 'react';

interface NumberedCardProps {
  order: number | string;
  title: string;
  badgeLabel?: string;
  children: React.ReactNode;
}

export const NumberedCard: React.FC<NumberedCardProps> = ({
  order,
  title,
  badgeLabel,
  children,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 hover:border-slate-300 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-christ-navy text-white text-xs font-bold flex items-center justify-center shrink-0">
            {order}
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
            {title}
          </h3>
        </div>
        {badgeLabel && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
            {badgeLabel}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
};
```

---

### 8.5 Component 4: `RatingScaleRow.tsx` (5-Point Likert Selector)

```tsx
import React from 'react';

interface RatingScaleRowProps {
  id: string;
  statement: string;
  value?: number;
  readOnly?: boolean;
  onChange: (val: number) => void;
}

export const RatingScaleRow: React.FC<RatingScaleRowProps> = ({
  id,
  statement,
  value,
  readOnly = false,
  onChange,
}) => {
  const scale = [1, 2, 3, 4, 5];

  return (
    <div className="p-4 sm:p-5 border border-slate-100 rounded-xl bg-white hover:bg-slate-50/50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex-1">
        <span className="inline-block text-xs font-mono font-bold text-slate-400 mr-2">
          {id.toUpperCase()}
        </span>
        <span className="text-sm font-medium text-slate-800 leading-relaxed">
          {statement}
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {scale.map((num) => {
          const isSelected = value === num;
          return (
            <button
              key={num}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(num)}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg font-bold text-xs flex flex-col items-center justify-center transition border ${
                isSelected
                  ? 'bg-christ-navy text-white border-christ-navy ring-2 ring-christ-gold shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
              } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
            >
              <span className="text-sm">{num}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
```

---

### 8.6 Component 5: `StickyWorksheetBar.tsx` (Worksheet Action Bar)

```tsx
import React from 'react';

interface StickyWorksheetBarProps {
  status: 'draft' | 'submitted' | 'not_started';
  isSaving: boolean;
  isReadOnly: boolean;
  lastSavedAt?: Date | null;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export const StickyWorksheetBar: React.FC<StickyWorksheetBarProps> = ({
  status,
  isSaving,
  isReadOnly,
  lastSavedAt,
  onSaveDraft,
  onSubmit,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg z-20 no-print">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Auto-save status */}
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Status:</span>
          <span
            className={`font-bold uppercase tracking-wider ${
              status === 'submitted'
                ? 'text-emerald-600'
                : status === 'draft'
                ? 'text-amber-600'
                : 'text-slate-400'
            }`}
          >
            {status.replace('_', ' ')}
          </span>
          {isSaving && (
            <span className="text-amber-600 font-semibold animate-pulse">
              (Saving...)
            </span>
          )}
          {!isSaving && lastSavedAt && (
            <span className="text-[11px] text-slate-400">
              Saved at {lastSavedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {!isReadOnly && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              Save Draft
            </button>
          )}

          {!isReadOnly && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSaving}
              className="px-6 py-2 text-xs font-bold text-white bg-christ-navy hover:bg-slate-800 rounded-lg shadow-md transition disabled:opacity-50 ring-1 ring-christ-gold cursor-pointer"
            >
              {status === 'submitted' ? 'Update & Re-Submit' : 'Submit Response'}
            </button>
          )}

          {isReadOnly && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              🔒 Locked (Read-Only)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

### 8.7 Component 6: `StatTile.tsx` (Analytical KPI Card)

```tsx
import React from 'react';

interface StatTileProps {
  label: string;
  value: number | string;
  subtext?: string;
  variant?: 'neutral' | 'emerald' | 'amber' | 'blue';
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subtext,
  variant = 'neutral',
}) => {
  const styles = {
    neutral: {
      card: 'bg-white border-slate-200',
      label: 'text-slate-500',
      value: 'text-slate-900',
      sub: 'text-slate-400',
    },
    emerald: {
      card: 'bg-emerald-50 border-emerald-200',
      label: 'text-emerald-800',
      value: 'text-emerald-700',
      sub: 'text-emerald-600',
    },
    amber: {
      card: 'bg-amber-50 border-amber-200',
      label: 'text-amber-800',
      value: 'text-amber-700',
      sub: 'text-amber-600',
    },
    blue: {
      card: 'bg-blue-50 border-blue-200',
      label: 'text-blue-800',
      value: 'text-blue-700',
      sub: 'text-blue-600',
    },
  }[variant];

  return (
    <div className={`border rounded-xl p-4 shadow-sm ${styles.card}`}>
      <span className={`text-xs font-semibold uppercase tracking-wider block ${styles.label}`}>
        {label}
      </span>
      <div className={`text-2xl font-black mt-1 font-mono ${styles.value}`}>
        {value}
      </div>
      {subtext && (
        <span className={`text-[11px] block mt-0.5 ${styles.sub}`}>
          {subtext}
        </span>
      )}
    </div>
  );
};
```

---

### 8.8 Component 7: `ProgressBadge.tsx` (Three-State Submission Pill)

```tsx
import React from 'react';

interface ProgressBadgeProps {
  status: 'submitted' | 'draft' | 'not-started';
}

export const ProgressBadge: React.FC<ProgressBadgeProps> = ({ status }) => {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Submitted
      </span>
    );
  }

  if (status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
        Draft Saved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
      Not Started
    </span>
  );
};
```
