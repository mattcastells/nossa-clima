---
name: nossa-clima-relevamiento
description: Relevamiento mensual de proveedores de aire acondicionado — discovery, scraping, deduplicación y sincronización con Supabase. Usar cuando pidan correr o revisar el relevamiento, buscar proveedores nuevos, actualizar datos de tiendas desde sus sitios web, revisar candidatos pendientes, o tocar cualquier cosa bajo tools/supplier-survey/. Incluye los comandos, cómo leer el reporte, cómo aprobar candidatos y qué NO hacer nunca.
---

# Relevamiento de proveedores — Nossa Clima

Pipeline de discovery + scraping + normalización + deduplicación + persistencia.
El código vive en `tools/supplier-survey/`. **Esta skill no scrapea: orquesta.**
Si algo hay que decidir con lógica, va en el código, no en el prompt.

---

## Las tres reglas que no se rompen

1. **El pipeline nunca escribe en Supabase.** Genera un `.sql` idempotente.
   Aplicarlo lo decide una persona. No inventes un `--apply`.
2. **Ninguna empresa relevada entra sola a `stores`.** `stores` es el catálogo
   compartido que el técnico ve al elegir el origen de un material: si se llena
   de empresas sin verificar, esa pantalla se vuelve inusable. Los candidatos
   quedan en `supplier_candidates` hasta que alguien los aprueba.
3. **El dato de una persona le gana al del scraper.** Nunca escribas directo en
   `stores` para "arreglar" un conflicto. Los conflictos se resuelven a mano o
   ajustando la política de merge, no salteándola.

---

## Comandos

```bash
npm run survey              # completo: sitios conocidos + discovery
npm run survey:update       # solo actualiza lo que ya conocemos
npm run survey:discover     # solo busca empresas nuevas
npm run survey:snapshot     # baja el estado de la base a disco
npm run survey:report       # reimprime el último reporte

# Cargar una planilla relevada a mano (.xlsx)
npm run survey:import -- --file Tiendas_insumos_refrigeracion_AMBA.xlsx
```

Opciones útiles (van después de `--`):

```bash
npm run survey -- --provider serper     # buscador: file | serper | brave | none
npm run survey -- --state artifacts/supplier-survey/state.json   # offline
npm run survey -- --max-new 10 --log debug
npm run survey -- --force               # ignora la caché y vuelve a bajar todo
```

`node tools/supplier-survey/cli.ts help` lista todo.

**Requiere Node 22+**: el pipeline son `.ts` que Node ejecuta borrando los tipos.

Los scripts de `package.json` cargan `.env` con `--env-file-if-exists`. Si
invocás el CLI a mano con `node tools/supplier-survey/cli.ts …` **no lee `.env`**
y va a decir que faltan credenciales. Agregale el flag o usá `npm run survey`.

---

## Credenciales

En `.env` o en el entorno:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
SURVEY_SUPABASE_EMAIL=...        # cae a KEEPALIVE_EMAIL si no está
SURVEY_SUPABASE_PASSWORD=...     # cae a KEEPALIVE_PASSWORD
SERPER_API_KEY=...               # opcional
```

Lectura con anon key + login de usuario, igual que `keep-alive.yml`.
**La `service_role` no entra a este repo.**

Sin credenciales el pipeline corre igual pero contra un estado vacío: **todo
aparece como empresa nueva y el SQL no sirve**. Si ves eso en el reporte,
faltan credenciales; no es un hallazgo.

---

## El flujo completo, paso a paso

```
1. npm run survey
2. leer artifacts/supplier-survey/latest.report.md
3. revisar la cola:  select * from public.supplier_review_queue
                     order by relevance_score desc;
4. correr latest.sync.sql en el SQL editor de Supabase
5. aprobar o descartar candidatos uno por uno
```

### Paso 2 — leer el reporte

El reporte contesta solo, sin abrir nada más: cuántos sitios se procesaron,
cuántos se actualizaron, cuántos fallaron y por qué, cuántas empresas nuevas
hay, cuántos duplicados, qué registros cambiaron, qué requiere revisión y de qué
URL salió cada dato.

Lo que hay que mirar primero, en este orden:

| Sección | Qué significa |
|---|---|
| **Requieren revisión manual** | lo único que necesita a una persona |
| **Sitios que fallaron** | si son todos, el problema es de red o del filtro, no de los sitios |
| **Registros que cambiaron** | el diff exacto que va a aplicar el SQL |
| **Discovery** | si `descartados` es casi igual a `resultados`, las consultas están mal |

### Paso 4 — aplicar el SQL

`artifacts/supplier-survey/latest.sync.sql`. Es idempotente: se puede correr más
de una vez sin duplicar nada. Requiere la migración
`supabase/migrations/202609080001_supplier_survey.sql` aplicada.

**Leerlo antes de correrlo.** Los `update public.stores` son el único punto
donde el relevamiento toca datos que ya existían.

### Paso 5 — aprobar candidatos

```sql
-- Ver la cola
select id, name, canonical_domain, relevance_score, decision, match_reason
from public.supplier_review_queue
order by relevance_score desc;

-- Aprobar: crea la tienda (o enriquece la existente si el dominio ya está)
select public.promote_supplier_candidate('<id>');

-- Descartar
select public.discard_supplier_candidate('<id>', 'no vende insumos, solo instala');
```

`promote_supplier_candidate` es idempotente y hace el etiquetado de origen
correcto. **Nunca hagas el INSERT a mano.**

**Descartar es definitivo.** El pipeline lee los dominios ya descartados y no
los vuelve a proponer. Por eso conviene descartar explícitamente en vez de
ignorar la fila: si la ignorás, vuelve el mes que viene.

La cola solo muestra `new` y `needs_review`. Las actualizaciones de tiendas
conocidas no aparecen ahí: ya las aplicó el SQL y están en el reporte, bajo
"Registros que cambiaron".

---

## Importar una planilla relevada a mano

`npm run survey:import -- --file <planilla.xlsx>` lee un xlsx y lo pasa por el
mismo pipeline: deduplicación, merge a tres vías, trazabilidad y SQL idempotente.
Lee el xlsx sin dependencias (`import/zip.ts` + `import/xlsx.ts`).

El formato esperado es el de `Tiendas_insumos_refrigeracion_AMBA.xlsx`
(`import/ambaSheet.ts`), con hojas `Tiendas AMBA`, `AMBA sin precios web`,
`Fuera del AMBA`, `Comparativa precios` y `Metodologia`. Las columnas se ubican
**por encabezado**, no por posición: agregar una columna al medio no rompe nada.

Diferencia con el scraper, y es la única: **una planilla la armó y verificó una
persona**, así que las tiendas de la hoja principal —las que además tienen
precios relevados— entran directo al catálogo. Las otras dos hojas van a
`supplier_candidates`, porque son proveedores reales pero nadie decidió todavía
si el equipo los usa.

Dos reglas de mapeo que hay que respetar si tocás `import/`:

1. **El precio que se guarda es el unitario, no el publicado.** La app multiplica
   cantidad × precio. Si guardaras los $83.421 del rollo de 15 m, un trabajo de
   8 metros saldría diez veces más caro. El publicado va en las notas y la
   presentación en `quantity_reference`.
2. **En un material la medida es la identidad.** `companyNameKey` descarta los
   números, así que `Manguera cristal 1/4"` y `Manguera cristal 5/8 (mt)` dan
   0,94 de similitud. Para materiales se usa `normalize/material.ts`, que
   compara medidas primero: distinta medida, distinto material, sin discusión.

## Discovery sin API key

Por defecto el proveedor es `file`: lee `tools/supplier-survey/seeds/candidates.json`.

Si no hay `SERPER_API_KEY` ni `BRAVE_SEARCH_API_KEY`, **el discovery lo hacés vos
con búsqueda web**: buscá proveedores usando las consultas de
`seeds/queries.json`, escribí las URLs en `candidates.json` y corré el pipeline.
El filtro de relevancia, la deduplicación y el scraping son los mismos: no
saltees el pipeline cargando empresas a mano.

```json
[
  { "url": "https://ejemplo.com.ar", "title": "...", "snippet": "...", "query": "..." }
]
```

Alcanza con `url`. El archivo se vacía después de una corrida exitosa solo si
vos lo vaciás; no se limpia solo.

---

## Dónde tocar cada cosa

| Querés… | Archivo |
|---|---|
| agregar consultas de búsqueda | `seeds/queries.json` |
| agregar un sitio fijo a relevar | `seeds/sources.json` |
| cambiar qué se considera del rubro | `discovery/relevance.ts` |
| soportar otro tipo de sitio | `extract/strategies/` + `extract/registry.ts` |
| cambiar qué campos toca el scraper | `merge/policy.ts` |
| cambiar el umbral de duplicados | `dedupe/match.ts` |
| otro buscador | `discovery/provider.ts` + `discovery/providers/` |
| cambiar el SQL generado | `persist/sql.ts` |

**Una tienda con web cargada en la app se releva sola.** No hace falta copiarla
a `seeds/sources.json`: el pipeline lee `stores.website` en cada corrida.

---

## La política de merge, que es lo que más se malinterpreta

`stores.scraped_snapshot` guarda lo último que escribió el scraper. Con eso se
hace un merge a tres vías, como un `git merge`:

| base (snapshot) | en la base | el sitio dice | resultado |
|---|---|---|---|
| — | — | X | escribe X |
| X | X | Y | escribe Y |
| X | **Z** | Y | **conflicto**, no toca |
| X | Z | X | no toca |

Por campo (`merge/policy.ts`):

- `website`, `email`, `canonical_domain` → **managed**: completa y refresca.
- `address`, `phone` → **fill-only**: completa si está vacío, después no toca.
- `name`, `description`, `notes` → **protegidos**: el scraper no escribe nunca.
  `description` es el horario de atención y `notes` el celular del vendedor:
  son los datos que el técnico realmente usa.

Un cambio de nombre siempre es `needs_review`: puede ser un rebranding o puede
ser que el matching se equivocó de empresa.

---

## Precios

`store_item_prices` es un histórico, así que insertar **no pisa** ningún precio
cargado a mano: agrega una observación con su fecha, su `source_url` y
`source_type = 'scraper'`. La deduplicación es por `external_ref` (dominio +
producto + precio + moneda): mismo precio → no entra de nuevo; precio distinto →
observación nueva.

Solo se insertan precios de productos con **tienda e item identificados con
certeza** (SKU igual, o nombre casi idéntico y marca compatible). El resto queda
en `supplier_product_candidates`. Un precio mal adjudicado termina en el informe
que ve un cliente: ante la duda, revisión.

El scraper **no crea items**.

---

## Buenas prácticas de scraping (ya implementadas, no las desarmes)

- `robots.txt` se respeta siempre; un 401/403 al robots.txt bloquea el sitio.
- Rate limit por host (2s por defecto), con el `Crawl-delay` del sitio si lo declara.
- User-Agent identificable con URL de contacto.
- ETag / Last-Modified: si el sitio no cambió, no se vuelve a bajar.
- Tope de 6 páginas por sitio, y nunca sale del dominio.
- Solo datos comerciales públicos. Nombres de personas no se guardan (Ley 25.326).

Si vas a subir la concurrencia o bajar el delay, que sea porque un sitio
concreto lo aguanta, no por defecto.

---

## Automatización

`.github/workflows/supplier-survey.yml`: día 1 de cada mes + `workflow_dispatch`.
Sube el SQL y el reporte como artifacts y abre un issue con el resumen.
**No escribe en la base.**

Reusa el patrón y los secrets de `keep-alive.yml`, que ya existía. No agregues
un scheduler paralelo.

---

## Antes de terminar, siempre

```bash
npm run lint
npm run typecheck
npm test
```

Si tocaste normalización, deduplicación, merge o el SQL generado: **va con
test**. Están en `tools/supplier-survey/__tests__/`. El de `merge.test.ts` es el
que más importa — es el que impide que el scraper pise trabajo humano.

Si agregaste una migración, decilo explícito al reportar: **hay que correr el
SQL en Supabase a mano.**
