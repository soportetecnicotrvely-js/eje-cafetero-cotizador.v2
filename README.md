# Cotizador Eje Cafetero — VERSIÓN 2

Segunda opción visual del mismo cotizador (misma marca, mismas reglas de
tarifa, mismo backend), pensada para comparar en la presentación junto a la
**Versión 1** (formato "tiquete de viaje").

## Qué cambia frente a la v1

| | V1 (tiquete) | V2 (checkout moderno) |
|---|---|---|
| Elegir fecha | `<select>` desplegable | Carrusel horizontal de tarjetas de fecha (com "flight board") |
| Pasajeros | Grilla de 3 columnas con steppers cuadrados | Contadores minimalistas circulares dentro de una franja beige |
| Resultado | Todo apilado en una sola columna | Dos columnas: descriptivo a la izquierda, precio "sticky" a la derecha (se queda visible mientras el usuario revisa el itinerario) — en móvil se apila con el precio primero |
| Itinerario | Lista con línea de tiempo simple | Línea de tiempo con "chips" numerados por día |
| Confirmación | Ícono de check simple | Anillo circular animado con check |

**Lo que NO cambia** (porque no debía cambiar): la paleta oficial Burgundy
`#B41241` / Beige `#F4E5D2` / Blanco, la tipografía Montserrat + Work Sans,
las reglas de tarifa (niño/infante/categoría de habitación), el descriptivo
que solo aparece después de cotizar y que cambia según la salida, y todo el
backend (Supabase + n8n) — son exactamente los mismos archivos que en la v1,
copiados tal cual, porque el modelo de datos no depende del diseño visual.

## Estructura

Igual que la v1: `index.html`, `styles.css`, `app.js`, `data.js`, `config.js`,
`supabase/schema.sql`, `n8n/*.json`. Todo el CSS está prefijado con `.cw2`
(en vez de `.cw` de la v1) y el contenedor se llama
`#eje-cafetero-cotizador-v2` — así, si quieres armar una página de
comparación con las dos versiones una al lado de la otra para la
presentación, puedes montarlas juntas sin que sus estilos choquen.

## Despliegue

Idéntico al de la v1 (ver su README): subir a GitHub Pages, correr
`supabase/schema.sql` en tu proyecto de Supabase (puede ser el **mismo**
proyecto que ya usas para la v1, ya que la tabla es la misma), pegar tus
llaves en `config.js`, e importar los dos workflows de `n8n/`.

## Si quieres una página de comparación lado a lado

Puedo armarte, como siguiente paso, un `comparacion.html` que cargue las dos
versiones (v1 y v2) en columnas una junto a la otra, para la presentación —
solo dime cómo vas a organizar las carpetas en el repositorio (si van a
quedar como subcarpetas `/v1` y `/v2`, por ejemplo) y ajusto las rutas.
