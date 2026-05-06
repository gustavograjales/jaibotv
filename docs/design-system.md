# JAIBO Design System

## 1. Brand Core

JAIBO es una plataforma de contenido impulsada por señal inteligente.

**Concepto central:** "La señal de la Jaiba"

**Personalidad:** premium tech, minimalista, oscuro, sistémico.

**Inspiración:** señal, ondas, transmisión, sistema.

**Evitar:** estética deportiva tradicional (escudos, balones, mascotas clásicas).

---

## 2. Colores

> Fuente de verdad: `src/styles/tokens.css`. Esta documentación referencia los tokens por nombre, no por valor.

### Base
| Token | Valor | Uso |
|-------|-------|-----|
| `--color-bg` | `#0A0A0A` | Fondo principal de la app |
| `--color-primary` | `#00AEEF` | Color de marca, CTAs primarios |
| `--color-accent` | `#00FFC6` | Acentos, hover states, highlights |
| `--color-ui` | `#1E1E1E` | Cards, paneles, superficies |
| `--color-text` | `#FFFFFF` | Texto principal |

### Semánticos (usar estos en componentes)
| Token | Uso |
|-------|-----|
| `--color-surface` | Superficie base de cards y paneles |
| `--color-surface-elevated` | Modales, dropdowns, capas superiores |
| `--color-border` | Bordes sutiles |
| `--color-border-strong` | Bordes con más presencia |
| `--color-text-primary` | Texto principal |
| `--color-text-muted` | Texto secundario (60% opacidad) |
| `--color-text-subtle` | Texto terciario, captions (40% opacidad) |
| `--color-success` | Confirmaciones, estados positivos |
| `--color-error` | Errores, destructivo |
| `--color-warning` | Advertencias |

### Distribución de uso
- **80%** fondo oscuro (`--color-bg`, `--color-surface`)
- **15%** azul primario (`--color-primary`)
- **5%** acentos cyan (`--color-accent`)

---

## 3. Tipografía

### Familias
- **Body:** Inter — pesos 400, 500, 600
- **Display:** Space Grotesk — para títulos y headers

### Escala
| Token | Tamaño | Uso |
|-------|--------|-----|
| `--text-xs` | 12px | Captions, labels |
| `--text-sm` | 14px | Texto secundario |
| `--text-base` | 16px | Body por defecto |
| `--text-lg` | 18px | Body destacado |
| `--text-xl` | 24px | H3 |
| `--text-2xl` | 32px | H2 |
| `--text-3xl` | 44px | H1, hero |

### Line height
- `--leading-tight` (1.2) — títulos
- `--leading-normal` (1.5) — body
- `--leading-relaxed` (1.7) — bloques largos de lectura

---

## 4. Logo

### Versiones
- **JAIBO Signal** (`design/logo/jaibo-signal.svg`) — versión principal con ondas simétricas
- **JAIBO Monogram** (`design/logo/jaibo-monogram.svg`) — "J" para favicon, avatares, espacios reducidos
- **JAIBO Core** (`design/logo/jaibo-core.svg`) — símbolo aislado para watermarks, loaders, sistema

### Reglas
- Mantener clear space mínimo igual a la altura del símbolo
- No deformar, rotar ni recolorear arbitrariamente
- No aplicar sombras pesadas ni gradientes complejos
- Sobre fondos oscuros (preferido) o blancos sólidos
- Los SVGs usan `currentColor` cuando aplica, para recolorear vía CSS

---

## 5. Iconografía

- Estilo lineal (outline)
- Stroke consistente: 2px en tamaños pequeños, 3px en grandes
- Bordes redondeados (rounded line cap)
- Tamaños estándar: 16, 20, 24, 32 px

---

## 6. Motion

### Duraciones
- `--duration-fast` (150ms) — micro-interacciones, hovers
- `--duration-base` (250ms) — transiciones estándar
- `--duration-slow` (400ms) — entradas/salidas de paneles

### Easing
- `--ease-out` — entradas, elementos que aparecen
- `--ease-in-out` — transiciones de estado

### Patrones
- **Ondas:** expansión radial desde un punto (concepto de señal)
- **Hover:** glow sutil cyan (`--glow-primary` o `--glow-accent`)
- **Focus:** anillo de color primario (`--color-focus-ring`)

---

## 7. Layout

### Grid base
8px — todo spacing es múltiplo de 8 (con xs=4 como excepción para detalles finos).

### Spacing tokens
- `--space-xs` (4px)
- `--space-sm` (8px)
- `--space-md` (16px)
- `--space-lg` (24px)
- `--space-xl` (32px)
- `--space-2xl` (48px)
- `--space-3xl` (64px)

---

## 8. UI Principles

- **Oscuro por defecto.** No hay modo claro en la fase actual.
- **Alto contraste.** Texto siempre legible sobre fondos oscuros.
- **Navegación tipo Netflix/Plex.** Filas horizontales, foco en contenido.
- **Contenido sobre UI.** La interfaz desaparece, la señal manda.
- **Simplicidad > decoración.**
- **Velocidad > complejidad.**
- **Sistema > contenido aislado.**

---

## 9. Componentes base

### Botón primario
- Fondo: `var(--color-primary)`
- Hover: `var(--color-accent)` + `var(--glow-primary)`
- Texto: `var(--color-bg)` (negro sobre azul para contraste)
- Radius: `var(--radius-md)`
- Padding: `var(--space-sm) var(--space-lg)`
- Transición: `var(--duration-base) var(--ease-out)`

### Card
- Fondo: `var(--color-surface)`
- Radius: `var(--radius-md)` (12px)
- Border: `1px solid var(--color-border)`
- Sombra: `var(--shadow-card)`

### Input
- Fondo: `var(--color-bg)` o `var(--color-surface)`
- Borde: `1px solid var(--color-border)`
- Focus: borde `var(--color-focus-ring)` + outline cyan sutil
- Radius: `var(--radius-sm)`

### Modal
- Fondo: `var(--color-surface-elevated)`
- Sombra: `var(--shadow-modal)`
- Backdrop: `rgba(0, 0, 0, 0.7)`

---

## 10. Anti-patterns

- ❌ Gradientes exagerados o multicolor
- ❌ Skeumorfismo (texturas, sombras realistas)
- ❌ Estética deportiva clásica (escudos, balones, mascotas)
- ❌ Hardcodear colores/spacing en componentes (usar tokens siempre)
- ❌ Múltiples acentos compitiendo en una misma vista
- ❌ Animaciones largas (>500ms) que estorben al usuario
- ❌ Tipografías ornamentales o serifs en UI
