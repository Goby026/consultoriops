# ConsultorioPS — Design System (interface-design)

## Dirección y sensación

Producto SaaS para consultorios psicológicos: tranquilo, cálido y clínico, nunca
"hospitalario frío". Jerarquía clara sobre ruido visual; calma sobre densidad.

- **Humanos:** psicólogos en consulta (entre sesiones), administradores del
  consultorio y recepcionistas en el mostrador. Tareas cortas y repetitivas:
  registrar sesión, agendar, firmar consentimiento.
- **Foco por vista:** la ficha clínica (detalle de sesión) y la métrica principal
  del Panel son los elementos que deben ganar en contraste.
- **Firma del producto:** la ficha clínica con secciones clínicas apiladas
  (anamnesis / SOAP / plan / diagnóstico / escalas) y el NHC; en UI, el
  indicador vertical `primary` en la navegación activa.

## Temas y color

- Solo temas claros; nunca se alterna `.dark`. Paleta declarada por
  `:root[data-theme=...]` en `src/index.css`:
  - **predeterminado** — monocromo negro (neutral, base).
  - **amethyst** — lavanda/ violeta (calma terapéutica).
  - **caffeine** — café/cálido (orgánico, libreta).
- Acento único (`--primary`) por tema; el color comunica estado/acción, no decora.
- Semantic tokens (oklch) únicos por tema; ningún hex aleatorio en componentes.
- Bordes suaves: en claro `oklch(0.922 0 0)`; ring de tarjeta `ring-foreground/10`.

## Depth (elevación) — capas con sombra

Estrategia: **sombras en capas**, no solo bordes.

- `--shadow-card: 0 0 0 1px oklch(0 0 0 / 0.04), 0 1px 2px -1px oklch(0 0 0 / 0.05), 0 3px 8px -2px oklch(0 0 0 / 0.04);`
- `--shadow-card-hover` y `--shadow-popover` (escala ascendente, sutil).
- `Card` usa `shadow-(--shadow-card) shadow-ring ring-foreground/10`.
- Espaciado base: múltiplos de 4px (`--spacing` de Tailwind v4).

## Tipografía e jerarquía

- Fuente: **Geist Variable** (únicas, `--font-heading` = `--font-sans`).
- Ratio ~1.25; cuerpo 14px. La jerarquía usa **peso + color + tamaño**, no tamaño solo.
- Levers clave:
  - Label de métrica: `text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground`.
  - Valor de métrica: `font-heading text-[1.75rem] font-semibold tracking-tight tabular-nums`.
  - Título de página: `text-2xl font-semibold tracking-tight` + `text-wrap: balance`.
- Base: `-webkit-font-smoothing: antialiased`, `text-rendering: optimizeLegibility`,
  `h1-h4 { text-wrap: balance }`, `body { text-wrap: pretty }`,
  `::selection { background: color-mix(in oklch, var(--primary) 18%, transparent) }`.
- Números dinámicos siempre con `tabular-nums`.

## Patrones de componentes

- **KpiCard** — tarjeta de métrica: tile `size-10 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10`, label uppercase tracked 11px, valor 28px `font-heading` tabular; `sub` opcional 12px muted. Estado loading → `…`.
- **EmptyState** (`src/components/EmptyState.tsx`) — icono en círculo `bg-muted ring-border` + título 14px/medium + pista 12px muted; contenedor `border-dashed rounded-lg py-10`. Usar en vez de `<p>` gris para estados vacíos.
- **Card activo/nav** — ítem activo: `bg-accent font-medium text-accent-foreground` + indicador `before:` vertical `w-0.5 h-4 bg-primary rounded-full` centrado a la izquierda (`left-0`, `top-1/2`). Hover: `hover:bg-accent/60`.
- **Sidebar** — mismo fondo que el lienzo (`bg-background`), separado solo por `border-r`; marca = tile `size-8 rounded-lg bg-primary text-primary-foreground` + nombre + subtítulo 11px.
- **Login/identidad** — wash radial del `accent` del tema:
  `radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--accent) 60%, transparent), transparent 70%)` + tile `size-11 rounded-xl bg-primary` + nombre + tagline.
- **Button** — feedback de presión `active:scale-[0.98]` (mantener `translate-y-px` existente).

## Notas

- No mezclar estrategias de profundidad: usar las sombras en capas definidas, no bordes duros ni sombras dramáticas.
- Acento único: no agregar colores semánticos nuevos (éxito/aviso) sin token propio; prefiere `text-primary` para tendencias/deltas.
- Verificación tras editar UI: `npm run lint` (oxlint) + `npm run build` (tsc + vite).
