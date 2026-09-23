# Navigation rebuild

## Why it changes

`App.tsx` currently carries the whole IA in one breadcrumb header. That worked when
there was one entry point. There are now two — GitHub pull requests and local
branches — and from inside one you cannot see the other, because the crumb only
shows the path you took. Adding a third track would make the header longer, not
clearer.

The fix splits the job in three:

| Concern | Owner |
| --- | --- |
| Which section am I in | the rail, always mounted, never scrolls |
| Where am I in it | the crumb bar, plus this screen's actions at its right edge |
| Moving without going back | the pager, and ⌘K |

The rail owns the brand and section switching, so the crumb bar loses both.

## AppShell

Introduce `client/src/components/AppShell.tsx`. It wraps everything `App.tsx`
renders today and takes the active section plus the crumb content:

```tsx
type Section = "prs" | "local" | "repos" | "settings";

interface AppShellProps {
  section: Section;
  crumbs: React.ReactNode;   // rendered into the bar, left side
  actions?: React.ReactNode; // rendered into the bar, right side
  children: React.ReactNode;
}
```

Derive `section` from the existing `ViewState` by prefix — do not add a second
source of truth:

```ts
const section: Section = state.view.startsWith("local") ? "local" : "prs";
```

That is the whole point of the prefix convention: a third track means a third
prefix, not a header rewrite.

### Rail

226px, `bg-rail-bg`, `border-r-2 border-fg`, full height, `flex flex-col`.

1. Brand — acid mark (24px `Icon name="mark"`) + "PR Review / Desk" in
   `font-display`, `text-acid`, uppercase, two lines.
2. ⌘K button — full width, `border-2 border-rail-line`, `text-rail-fg`,
   label "Jump to…" with a `kbd` chip on the right. Hover turns the border acid.
3. Section list — `Pull requests` (count), `Local branches` (count),
   `Repositories`, `Settings`. Each is 40px tall, icon + label + count in mono,
   `label-caps`. Inactive: transparent border, `text-rail-fg`; hover
   `bg-rail-hover` + `border-rail-line`. Active: `bg-acid text-fg border-acid`
   and `aria-current="page"`.
4. Footer, pushed down with `mt-auto` above a `border-t-2 border-term-border`:
   repo switcher button, then the current user.

The active item is the only acid block on the screen chrome, so it reads as
position rather than emphasis. Sections that are not built yet render as
`<button type="button">`, not `<a>`.

### Crumb bar

54px, `bg-page`, `border-b-2 border-fg`. Left: crumbs in `label-caps`,
`text-fg-3`, separated by a `/`; the last one is `text-fg`; object crumbs
(`linea-web #655`) stay `font-mono`, `normal-case`, 12px. Links get the acid
hover from the global `a:hover`. Right: this screen's actions — status tag,
Refresh, Open on GitHub, and the pager.

### Pager

New `client/src/components/ui/Pager.tsx`: two 32×30 buttons in one
`border-2 border-fg` box, sharing a 2px divider. Hover fills acid; the end of the
range is `disabled`, never hidden, so the control does not move under the cursor.

- PR detail / failed → previous / next PR in the list order the user came from.
- Finding detail → previous / next finding. `FindingDetail` already accepts
  `onSelectFinding`; pass the sorted sibling ids in and wire J / K to the same
  handlers.

A `<span class="label-caps">PR 1 of 7</span>` sits to its left.

### Back

One explicit control per screen, labelled with its destination — "All findings",
"All branches", "Back to pull requests" — placed in the crumb bar's action area,
not a bare arrow floating above the content. Esc does the same thing.

### ⌘K

Not built yet; ship the button disabled-looking but focusable, or behind a flag.
When it lands it searches PRs, local branches and findings by title, and is the
only way to cross tracks without passing through a list.

## Keyboard

Already implied by the comps, worth building with the shell:

| Screen | Keys |
| --- | --- |
| PR list, Local branches | `J`/`K` move, `↵` open, `R` run review |
| PR detail | `X` select, `P` post, `Esc` back |
| Finding detail | `J`/`K` prev/next finding, `Esc` all findings |

## Read-only findings

`FindingDetail` already takes `readOnly`. In the new design that prop **removes**
the entire right column — comment editor, post, dismiss — rather than disabling
it. On a local branch there is nowhere to post, so a greyed-out Post button would
be a lie. Evidence bands, references and the diff stay. The layout becomes single
column and the diff keeps its full width.
