# 🎨 KikoBingo - Guía de Estilos

## Filosofía de Diseño

KikoBingo utiliza un diseño **inspirado en Spotify**, con tonos oscuros y el icónico verde de la plataforma. La interfaz prioriza la legibilidad, accesibilidad y una experiencia inmersiva similar a las apps de música.

## 🎨 Paleta de Colores - Estilo Spotify

### Colores Principales

| Variable | Color | Hex | Uso |
|----------|-------|-----|-----|
| `--primary-color` | Verde Spotify | `#1DB954` | Botones, acentos, elementos activos |
| `--primary-hover` | Verde Spotify claro | `#1ed760` | Estados hover |
| `--secondary-color` | Verde Spotify | `#1DB954` | Enlaces, elementos secundarios |
| `--accent-color` | Verde Spotify | `#1DB954` | Elementos marcados, destacados |

### Fondos y Superficies

| Variable | Color | Hex | Uso |
|----------|-------|-----|-----|
| `--background-dark` | Negro Spotify | `#121212` | Fondo principal |
| `--background-darker` | Negro puro | `#000000` | Fondos más profundos |
| `--surface-color` | Gris muy oscuro | `#181818` | Tarjetas, contenedores |
| `--surface-light` | Gris oscuro | `#282828` | Bordes, divisores |

### Textos

| Variable | Color | Hex | Uso |
|----------|-------|-----|-----|
| `--text-primary` | Blanco | `#FFFFFF` | Texto principal |
| `--text-secondary` | Gris claro | `#B3B3B3` | Texto secundario |
| `--text-muted` | Gris Spotify | `#535353` | Texto deshabilitado |

### Estados

| Variable | Color | Hex | Uso |
|----------|-------|-----|-----|
| `--success-color` | Verde Spotify | `#1DB954` | Éxito, confirmaciones |
| `--error-color` | Rojo Spotify | `#E91429` | Errores |

## 🔤 Tipografía

### Fuentes

```css
font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
```

**Jerarquía de fuentes**:
1. Montserrat (preferida - similar a Circular usada por Spotify)
2. System fonts (fallback)

### Tamaños

| Elemento | Tamaño Desktop | Tamaño Móvil |
|----------|----------------|--------------|
| Título principal (h1) | 56px | 36-42px |
| Subtítulo | 18px | 14-16px |
| Sección título | 28px | 20-24px |
| Texto body | 16px | 14px |
| Texto pequeño | 12px | 10-11px |

### Pesos

- **Regular**: 400 - Texto normal
- **Medium**: 500 - Etiquetas, subtítulos
- **Semibold**: 600 - Títulos de sección
- **Bold**: 700 - Títulos principales
- **Extra Bold**: 800 - Título de marca

## 📐 Espaciado

Sistema basado en múltiplos de 4px:

| Nombre | Valor | Uso |
|--------|-------|-----|
| `xs` | 4px | Gaps mínimos |
| `sm` | 8px | Espaciado interno pequeño |
| `md` | 16px | Padding estándar |
| `lg` | 24px | Separación entre secciones |
| `xl` | 32px | Padding de contenedores |
| `2xl` | 48px | Márgenes grandes |

## 🔲 Componentes

### Contenedor Principal

```css
.container {
    background: var(--surface-color);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 16px 64px rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(100, 116, 139, 0.2);
    backdrop-filter: blur(10px);
}
```

### Botones

**Botón Primario**:
```css
.btn-primary {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
    border-radius: 50px;
    padding: 12px 32px;
    font-weight: 700;
    box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);
}
```

**Variantes**:
- `.btn-green` - Acciones positivas (unirse)
- `.btn-secondary` - Acciones secundarias (borde)
- `.btn-whatsapp` - Compartir WhatsApp (verde)

### Inputs

```css
.form-input {
    background: var(--background-dark);
    border: 2px solid var(--surface-light);
    border-radius: 8px;
    padding: 12px 16px;
    /* Focus: borde primary + shadow */
}
```

### Celda de Bingo

```css
.bingo-cell {
    background: var(--surface-color);
    border-radius: 8px;
    min-height: 100px;
    /* Hover: elevación + borde cyan */
}

.bingo-cell.marked {
    background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%);
    /* Checkmark en esquina superior derecha */
}
```

## 🎭 Efectos y Animaciones

### Transiciones Globales

```css
* {
    transition: color 0.2s ease, background-color 0.2s ease;
}
```

### Animación de Pulso (Victoria)

```css
@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
```

### Efecto Flotante (Fondo)

```css
@keyframes float {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    33% { transform: translate(30px, -30px) rotate(120deg); }
    66% { transform: translate(-20px, 20px) rotate(240deg); }
}
```

### Hover en Botones

```css
.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px 0 rgba(99, 102, 241, 0.6);
}
```

## 📱 Responsive Design

### Breakpoints

| Breakpoint | Descripción |
|------------|-------------|
| `768px` | Tablets y móviles grandes |
| `480px` | Móviles medianos |
| `360px` | Móviles pequeños |

### Orientación Móvil

- **Portrait**: Muestra aviso de rotación (solo en vista jugador)
- **Landscape**: Interfaz optimizada para juego

### Grid del Cartón

```css
/* Desktop y landscape */
grid-template-columns: repeat(5, 1fr);

/* Móviles muy pequeños (<360px) */
grid-template-columns: repeat(3, 1fr);
```

## 🌈 Gradientes Destacados

### Título Principal

```css
background: linear-gradient(135deg, 
    var(--primary-color) 0%, 
    var(--secondary-color) 50%, 
    var(--accent-color) 100%
);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Fondo Body

```css
background: linear-gradient(135deg, 
    var(--background-darker) 0%, 
    var(--background-dark) 50%, 
    var(--surface-color) 100%
);
```

## 📦 Iconos

**Librería**: Font Awesome 6.0

**Iconos Utilizados**:
- `fa-spotify` - Spotify
- `fa-play` - Iniciar
- `fa-sign-in-alt` - Unirse
- `fa-whatsapp` - Compartir
- `fa-mobile-alt` - Aviso orientación
- `fa-circle` - Estado canción
- `fa-check` (✓) - Marcado CSS

## 🎯 Buenas Prácticas

1. **Usa variables CSS** para todos los colores
2. **Mantén consistencia** en espaciados (múltiplos de 4px)
3. **Prioriza accesibilidad**: outlines visibles en focus
4. **Mobile-first** cuando añadas nuevos estilos
5. **Evita !important** excepto para overrides de orientación
6. **Usa gradientes** para elementos destacados
7. **Añade transiciones** para feedback visual suave

