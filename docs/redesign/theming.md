# Theming — two systems behind one switch

The redesign ships **two** design systems, not one. They are not a light/dark
pair: they are two different visual languages that happen to share a token grid.

| | Neo-brutalism | Blueprint |
| --- | --- | --- |
| Ground | warm bone `#EDE9E0` | graph paper `#F7F8F7`, 22px grid |
| Border | 2px ink | 1px hairline |
| Radius | 0 | 2px |
| Elevation | hard 5px offset shadow | none, ever |
| Display | Anton | Martian Mono 800 |
| UI | Archivo | JetBrains Mono |
| Severity / status | filled colour block | coloured label, quiet box |
| Reads like | a poster | a spec sheet |

Both have a dark mode. Four combinations total, and `index.css` carries all four.

## How it works

`@theme` holds the defaults (brutalism / light) so Tailwind generates utilities
against them. The other three combinations are plain CSS-variable overrides in
`@layer base`, keyed off two attributes on `<html>`:

```html
<html data-system="brutal|blueprint" data-theme="light|dark">
```

Because `bg-surface` compiles to `background-color: var(--color-surface)`, every
component follows the active system without knowing it exists. **Colour token
names are identical across systems** — that is the whole contract. Never write a
system-specific colour in a component.

### The structural tokens

Colour is the easy half. What actually separates the two systems is five
non-colour variables, declared on `:root` and overridden per system:

| Token | Brutal | Blueprint | Used by |
| --- | --- | --- | --- |
| `--bw` | 2px | 1px | the `edge*` utilities |
| `--radius-*` | 0 | 2px | `rounded-*` |
| `--shadow-lift` | 5px offset | none | `lift`, `lift-sm` |
| `--grid-color` / `--grid-size` | transparent / 0 | 4.5% ink / 22px | `body` background |
| `--label-tracking` | .14em | .22em | `label-caps` |

Plus `--font-sans` / `--font-display`, `--row-h`, `--ctl-h`, `--page-pad`.

### Utilities, not raw classes

Three rules keep the switch honest:

1. **Never `border`.** Use `edge`, `edge-t`, `edge-b`, `edge-r`. A literal
   `border` class pins 1px and the brutal system silently loses its weight.
   The one exception is `edge-soft` — the 1px divider *inside* a bordered block,
   which is 1px in both systems by design.
2. **Never `shadow-*` directly.** Use `lift` / `lift-sm`.
3. **Never a hard-coded hex.** If a colour is needed that has no token, add the
   token to all four blocks rather than inlining it.

The `press` utility carries the interaction difference: brutalism translates into
its shadow, blueprint has that suppressed and moves its border colour instead.
Both are in `index.css`; components just add `press`.

## SystemProvider

Add `client/src/components/SystemProvider.tsx`:

```tsx
type System = "brutal" | "blueprint";
type Theme = "light" | "dark";

const DEFAULT_SYSTEM: System = "brutal";   // the committed direction
const DEFAULT_THEME: Theme = "light";
```

It owns both values, writes them to `document.documentElement.dataset`
(`system`, `theme`), persists to `localStorage` under `prd:system` and
`prd:theme`, and exposes them through a context with setters. Read the stored
values **before first paint** with a tiny inline script in `index.html` so the
app does not flash the wrong system:

```html
<script>
  try {
    var d = document.documentElement.dataset;
    d.system = localStorage.getItem("prd:system") || "brutal";
    d.theme  = localStorage.getItem("prd:theme")  || "light";
  } catch (e) {}
</script>
```

`theme` may also be `"auto"`, resolved against `prefers-color-scheme` — add it
only if asked; two explicit values are enough to start.

## The switch control

Lives at the bottom of the rail, above the repo switcher. Two segmented
controls stacked, both built from the same `Segmented` primitive:

```
SYSTEM   [ BRUTAL | BLUEPRINT ]
MODE     [ LIGHT  | DARK      ]
```

Each is a `role="group"` with an `aria-label`, real `<button>` children, and
`aria-pressed` on the active one. Labels are `label-caps`. The active segment
fills `--color-fg` in brutalism and `--color-primary` in blueprint — that
difference is already in the CSS via the token, so the component needs no
conditional.

Behind a `SETTINGS_SHOW_SYSTEM_SWITCH` constant if you would rather not ship the
choice to users: the dual tokens cost nothing, the visible control is the part
worth gating.

## Verifying

The design canvas has a **Style switch** artboard that runs both systems off one
set of markup, with a live readout of the structural tokens. Match the behaviour
there. The acceptance test is blunt: flipping `data-system` on `<html>` in
devtools must change the whole app and break nothing — no element keeps a border
weight, a radius or a shadow from the other system.
