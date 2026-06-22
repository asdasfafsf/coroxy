# Coroxy Workbench Design System

## Direction

Coroxy's primary interface follows a desktop network-debugging workbench model, close to Fiddler Everywhere's Live Traffic view. The UI should feel dense, technical, and stable. Avoid marketing-dashboard styling, oversized type, rounded card-heavy layouts, decorative gradients, and isolated panels inside panels.

## Token Source

Runtime design tokens live in `frontend/src/style.css` under the `--ds-*` namespace. Component CSS should prefer these tokens over direct hex values or one-off pixel values.

## Core Surfaces

| Token | Use |
| --- | --- |
| `--ds-surface-app` | Live Traffic toolbar and primary chrome |
| `--ds-surface-base` | Buttons, tabs, inputs |
| `--ds-surface-sidebar` | Snapshots side panel |
| `--ds-surface-table` | Session grid body |
| `--ds-surface-table-header` | Session grid header |
| `--ds-surface-hover` | Button and sidebar hover states |
| `--ds-surface-active` | Active capture mode or selected tool surfaces |
| `--ds-surface-selected` | Selected rows |
| `--ds-surface-row-active` | Keyboard/current active row |

## Borders And Accents

| Token | Use |
| --- | --- |
| `--ds-border-subtle` | Default button, input, grid borders |
| `--ds-border-strong` | Split buttons, toggles, stronger dividers |
| `--ds-grid-line` | Body grid row and column lines |
| `--ds-grid-line-strong` | Stronger workbench separators |
| `--ds-accent-blue` | Live Traffic tab accent, capture mode focus group, capture icons |
| `--ds-danger` | Clear/delete actions |
| `--ds-beta-bg` | Small beta badge background |

## Density

| Token | Value | Use |
| --- | ---: | --- |
| `--ds-toolbar-height` | `57px` | Full Live Traffic header |
| `--ds-toolbar-tab-height` | `26px` | Tab strip |
| `--ds-toolbar-command-height` | `31px` | Command row and capture group |
| `--ds-toolbar-control-height` | `25px` | Primary toolbar controls |
| `--ds-sidebar-width` | `156px` | Default snapshots panel width |
| `--ds-sidebar-header-height` | `29px` | Snapshots header |
| `--ds-sidebar-row-height` | `22px` | Sidebar tree rows |
| `--ds-grid-header-height` | `26px` | Session grid header |
| `--ds-grid-row-height` | `27px` | Session grid rows |

## Typography

Use system UI first: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, then fallback to Inter. The workbench uses compact text:

| Token | Use |
| --- | --- |
| `--ds-toolbar-font-size` | Filter and icon button labels |
| `--ds-toolbar-mode-font-size` | Capture mode buttons |
| `--ds-grid-font-size` | Session grid cells and headers |
| `--ds-sidebar-font-size` | Snapshot tree |
| `--ds-tab-font-size` | Workspace tabs |

## Component Rules

- The top toolbar is a two-row Live Traffic header: tab strip above, command row below.
- The desktop app uses the native macOS titlebar. Do not add Wails-only titlebar padding in the frontend unless the Wails titlebar mode changes.
- Keep `App.tsx`'s `SIDEBAR_DEFAULT` aligned with `--ds-sidebar-width`.
- When default layout dimensions change, bump the matching localStorage version so stale user defaults do not mask the new baseline.
- Capture modes should read as flat segmented toolbar buttons; only the active mode gets a restrained blue accent. Avoid thick toy-like group outlines.
- `BETA` markers should be inline chips, not floating decorative badges.
- Save/share/column/layout-like actions should collapse into compact right-side icon controls when possible.
- Session grid defaults to Fiddler-like order: `#`, `URL`, `HTTP Version`, `TLS Version`, `Status Code`, `Method`, then supporting metadata.
- Grid columns should show filter affordances in the header.
- Empty grid backgrounds still use visible row and column rhythm. Avoid blank hero-style empty states in Live Traffic.
- Selection and active-row states must use `--ds-surface-selected` and `--ds-surface-row-active`, not generic primary blends.
- Sidebars are flat workbench panels, not cards.
- Border radius is restrained: `--ds-control-radius` for controls, `--ds-radius-tight` for tree rows and dense fields.
- Do not introduce new hard-coded colors for workbench primitives unless a new `--ds-*` token is added first.
