# Lineamientos de diseño — Nossa Clima (para Claude Code)

Seguí estas reglas SIEMPRE que crees o modifiques UI en este repo, para mantener
coherencia con el rediseño. Si algo no está cubierto acá, mirá el prototipo
(`prototipo/`) y las referencias, y en última instancia priorizá: **simple, claro,
mobile-first, pulgar-friendly**.

## Principios
- Mobile-first, para técnicos apurados en la calle. Menos es más.
- Nada de texto de relleno: subtítulos obvios, ayudas redundantes, explicaciones
  innecesarias. Cada texto ayuda a decidir o completar una acción.
- No repetir el nombre/eslogan de la marca cerca del logo (el logo ya los tiene).
- Toque mínimo 44px. Acción principal siempre alcanzable (FAB o CTA fijo).

## Tokens (usar SIEMPRE `useAppTheme()`, nunca hex sueltos)
- Marca: `primary` `#052653`. Acento (CTAs/foco/links): `accent` `#06B6D4`,
  `accentStrong` `#0891B2`, `accentSoft` `#E0F7FC`, texto sobre acento `onAccent` `#02323D`.
- Superficies: `background`, `surface`, `surfaceVariant`, borde `borderSoft`, `outline`.
- Texto: `titleOnSoft` (títulos/ink), `textMuted` (secundario).
- Semánticos: verde `toastSuccessText`/`softGreen` (ok/servicios), ámbar
  `onSoftYellow`/`softYellow` (precios/pendiente), rojo `error`/`toastErrorSurface` (peligro/cancelado).
- Radios: tarjetas 16–18, inputs 12, botones 12, pills 999. (`theme.roundness` = 12.)
- Espaciado: múltiplos de 4 (gap 8/10/12/14; padding 14–16 en tarjetas).
- Importes/números: peso 700–800, `fontVariant: ['tabular-nums']`.

## Recetas de componentes
**FAB / acción de alta:** `IconButton icon="plus" mode="contained"` con
`containerColor={accent}` `iconColor={onAccent}`, en `AppScreen.titleRight`.

**Buscador (pill):** fila `surface` + borde `borderSoft`, radio 14, ícono `magnify`
`textMuted`, `TextInput` nativo, botón limpiar `close-circle` cuando hay texto.

**Chip de filtro:** pill (radio 999). Activo = fondo del color semántico suave +
texto del color fuerte; inactivo = `surface` + borde `borderSoft` + `textMuted`.

**Tarjeta de lista:** `surface`, borde `borderSoft`, radio 16, padding 14–16.
Título 15–16/800 `titleOnSoft`. Metadatos con ícono + `textMuted`. Nada de
headers de color saturado dentro de la tarjeta.

**Badge de estado:** pill con `backgroundColor`/`borderColor`/`textColor` desde
`quoteStatusAccent()` + **punto de color + texto** (nunca solo el punto: accesibilidad).

**Botones:** principal = `contained` `buttonColor={accent}`/`textColor={onAccent}`;
secundario = navy (`primary`); contorno = `outlined`; peligro = texto/fondo `error`.

**Inputs (paper):** `mode="outlined"`, `outlineStyle={{borderRadius:12}}`,
`activeOutlineColor={theme.colors.accent}`.

**Filas de ajustes/settings:** agrupadas por sección (label uppercase `textMuted`),
tarjeta contenedora, cada fila = ícono en bubble + label + chevron/switch.

**Navegación:** tab bar inferior de 5 (Inicio/Trabajos/Agenda/Materiales/Asistente),
activo en `accentStrong` sobre pill `accentSoft`. Back en el encabezado en anidadas.

## Estados obligatorios
- **Vacío:** ícono grande `borderSoft` + una línea `textMuted` (sin párrafos).
- **Carga:** usar `LoadingOrError` existente o `ActivityIndicator` con `accent`.
- **Error:** mensaje corto accionable; toasts con tokens `toast*`.

## Qué NO hacer
- No hardcodear colores (usar tokens). No usar el lila viejo de diálogos.
- No poner headers de color fuerte arriba de cada card (patrón viejo).
- No indicar estado solo con color. No agregar textos explicativos de más.
- No tocar lógica al restilizar (hooks, forms, validaciones, params, permisos).

## Coverage del rediseño
Reestructuradas: navegación, Home, Login, Trabajos (lista), Materiales (lista+detalle),
Servicios (lista), Tiendas (lista), Opciones, Asistente, Calendario, estados de marca, PDF (color).
Reskineadas por theme: altas/ediciones, nuevo trabajo, add-material/add-service,
precios/comparación/historial, documentos, categorías, cleanup, diálogos/toasts.
Pendiente estructural: detalle de trabajo (`quotes/[id]/index.tsx`).
