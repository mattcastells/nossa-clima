# Relevamiento de proveedores de aire acondicionado

Pipeline reutilizable de **discovery + scraping + normalización + deduplicación +
persistencia**, pensado para correr una vez por mes.

No escribe en Supabase: genera un `.sql` idempotente y un reporte. Aplicarlo es
una decisión humana, igual que el resto de las migraciones de este repo.

Para el uso día a día está la skill `nossa-clima-relevamiento`. Este documento
es el detalle técnico.

---

## Ejecutar

```bash
npm run survey                 # completo
npm run survey:update          # solo sitios conocidos
npm run survey:discover        # solo buscar nuevos
npm run survey:snapshot        # bajar el estado de la base a disco
npm run survey:report          # reimprimir el último reporte
node tools/supplier-survey/cli.ts help

# Cargar una planilla relevada a mano
npm run survey:import -- --file Tiendas_insumos_refrigeracion_AMBA.xlsx
```

Salida en `artifacts/supplier-survey/`:

| Archivo | Qué es |
|---|---|
| `latest.sync.sql` | lo que hay que revisar y correr en Supabase |
| `latest.report.md` | el reporte de la corrida, para leer |
| `latest.report.json` | lo mismo, para una herramienta |
| `<fecha>-<run>.…` | la copia versionada de cada corrida |

**Node 22 o superior.** El pipeline son `.ts` que Node ejecuta borrando los
tipos (`type stripping`), sin build ni dependencias extra. Por eso no hay
parameter properties ni enums en el código: no existen en ese modo.

Los scripts de `npm` cargan `.env` con `--env-file-if-exists`. Invocar
`node tools/supplier-survey/cli.ts …` a secas **no lee `.env`**: o le agregás el
flag, o exportás las variables, o usás `npm run survey`.

### Correr sin tocar la red ni la base

```bash
npm run survey:snapshot -- --out artifacts/supplier-survey/state.json
npm run survey -- --state artifacts/supplier-survey/state.json --provider none
```

Útil para iterar sobre la normalización o el SQL sin pedirle nada a nadie.

---

## Cómo está armado

```
cargar estado de la base          persist/state.ts
      │                           (una sola vez, antes de decidir nada)
      ▼
relevar sitios conocidos          extract/scrapeSite.ts
      │                           cada sitio aislado en su propio try
      ▼
discovery de sitios nuevos        discovery/
      │                           buscar → filtrar por relevancia → descartar conocidos
      ▼
normalizar                        normalize/
      │                           dominio, teléfono AR, precio AR, nombre
      ▼
deduplicar y mergear              dedupe/ + merge/
      │                           matching en cascada + merge a tres vías
      ▼
plan de sincronización            persist/plan.ts   ← la única capa que decide
      │
      ▼
SQL + reporte                     persist/sql.ts + report/
```

Cada capa hace una cosa. El scraper no sabe qué va a pasar con lo que sacó; el
escritor de SQL no decide nada, ejecuta el plan.

### Directorios

| Ruta | Responsabilidad |
|---|---|
| `import/` | leer una planilla xlsx y cargarla por el mismo pipeline |
| `net/` | HTTP: robots.txt, rate limit por host, timeouts, reintentos, caché condicional |
| `discovery/` | buscar candidatos y descartar lo que no es del rubro |
| `extract/` | de HTML a datos, por estrategias intercambiables |
| `normalize/` | de datos crudos a valores comparables |
| `dedupe/` | huellas y matching contra lo que ya existe |
| `merge/` | qué se escribe y qué no |
| `persist/` | leer el estado, armar el plan, emitir el SQL |
| `report/` | el reporte de la corrida |
| `seeds/` | semillas, consultas y candidatos (se versionan) |

---

## Importar una planilla

`npm run survey:import -- --file <planilla.xlsx>`

Lee el xlsx sin dependencias: `import/zip.ts` recorre el ZIP e infla las
entradas con `zlib`, e `import/xlsx.ts` saca las celdas. `import/ambaSheet.ts`
mapea las hojas al modelo, ubicando las columnas **por encabezado**.

De ahí en adelante es el mismo pipeline: mismo matching, mismo merge a tres
vías, mismo SQL idempotente. Los ids de las filas nuevas son UUID v5 derivados
del contenido (`import/ids.ts`), así que reimportar la planilla no duplica nada.

### Las dos decisiones de mapeo que importan

**El precio guardado es el unitario, no el publicado.** La app hace
`cantidad × precio` para armar un trabajo. Guardar los $83.421 del rollo de 15 m
haría que un trabajo de 8 metros salga diez veces más caro. El precio publicado
queda en `store_item_prices.notes` y la presentación en `quantity_reference`.

**En un material, la medida es la identidad.** `companyNameKey` descarta los
tokens de un carácter, así que `Manguera cristal 1/4"` y
`Manguera cristal 5/8 (mt)` colapsan las dos a "manguera cristal" y dan 0,94 de
similitud. Importando la planilla real eso adjudicó el precio del cable 3x2,5 al
item 3x1,5. Por eso los materiales se comparan con `normalize/material.ts`, que
separa medidas de palabras: **distinta medida, distinto material**, sin importar
cuánto se parezcan los nombres.

## Trazabilidad

Ningún dato viaja pelado. Cada campo extraído lleva `Provenance`: URL exacta,
estrategia que lo sacó, confianza y timestamp. Eso es lo que permite que el
reporte diga de dónde salió cada cosa y que dos estrategias en desacuerdo se
resuelvan por confianza y no por orden de ejecución.

| Confianza | Estrategia | Por qué |
|---|---|---|
| 0.95 | `json-ld` | dato estructurado que el sitio publica para buscadores |
| 0.80 | `microdata` | ídem, formato viejo |
| 0.70 | `meta-tags` | Open Graph: estable, pero pensado para compartir |
| 0.40 | `heuristics` | leer el texto. Solo completa huecos |

**Los precios salen solo de `json-ld`, `microdata` o `meta-tags`.** Nunca de un
regex sobre el texto visible: `$1.234` en una promo tachada es indistinguible
del precio real sin estructura, y ese número termina en un informe de cliente.

### Agregar una estrategia

```ts
export const miEstrategia: CompanyStrategy = {
  name: 'mi-estrategia',
  confidence: 0.6,
  canHandle: (page) => /* chequeo barato */,
  extract: (page) => ({ name: field('...', provenance) }),
};
```

Y sumarla a `COMPANY_STRATEGIES` en `extract/registry.ts`. Nada más cambia. Una
estrategia que revienta se registra y el resto sigue.

---

## Idempotencia

Correr el pipeline dos veces, o correr el mismo `.sql` dos veces, no duplica nada:

| Qué | Cómo |
|---|---|
| tiendas | `update ... where id = <uuid>`; el merge a tres vías no propone nada si nada cambió |
| candidatos de empresa | índice único `(run_id, fingerprint)` + `on conflict do nothing` |
| candidatos de producto | índice único `(run_id, external_ref)` |
| observaciones de precio | índice único parcial sobre `external_ref` |
| fuentes | índice único sobre `canonical_domain` + `on conflict do update` |
| aprobar un candidato | `promote_supplier_candidate` busca el dominio antes de insertar |
| **descartar un candidato** | el dominio queda en `dismissedDomains` y no vuelve a proponerse |
| requests | ETag / Last-Modified, y hash del contenido como respaldo |

El test `merge.test.ts` verifica explícitamente que la segunda corrida con los
mismos datos no propone ningún cambio.

---

## Tests

```bash
npx vitest run tools/supplier-survey
```

171 tests sobre lo que puede romper en silencio:

| Archivo | Qué cubre |
|---|---|
| `merge.test.ts` | **el más importante**: que el scraper no pise trabajo humano |
| `material.test.ts` | que no se crucen medidas: el 3x2,5 no es el 3x1,5 |
| `import.test.ts` | el import contra la planilla real del repo |
| `normalize.test.ts` | dominios, teléfonos AR, precios AR vs ingleses, nombres |
| `dedupe.test.ts` | huellas estables, matching en cascada, umbrales |
| `extract.test.ts` | JSON-LD, microdatos, meta tags, resolución por confianza |
| `scrapeSite.test.ts` | el scraper completo con `fetch` inyectado |
| `pipeline.test.ts` | relevancia, robots.txt, rate limit, plan, SQL, reporte |

Ningún test sale a la red.

---

## Base de datos

Migración: `supabase/migrations/202609080001_supplier_survey.sql`.

| Tabla | Para qué |
|---|---|
| `supplier_survey_runs` | una fila por corrida, con sus estadísticas |
| `supplier_sources` | los sitios que relevamos y su salud |
| `supplier_candidates` | **staging** de empresas. Nada entra a `stores` sin pasar por acá |
| `supplier_product_candidates` | staging de productos y precios |
| `supplier_review_queue` | vista: lo único que hay que mirar tras cada corrida |

Columnas agregadas a `stores`: `website`, `email`, `canonical_domain`, `source`,
`source_type`, `source_url`, `last_scraped_at`, `scraped_snapshot`.
A `items`: las mismas de procedencia. A `store_item_prices`: `source_url` y
`external_ref`.

**`source_type = 'automated'` significa que el relevamiento CREÓ la fila**, no
que la tocó. Una tienda cargada a mano sigue siendo `manual` aunque el scraper
le complete el mail; qué campos son suyos se lee en `scraped_snapshot`.

- Todo lo que el relevamiento tocó: `where last_scraped_at is not null`
- Todo lo que el relevamiento creó: `where source_type = 'automated'`

---

## Límites conocidos

- **Sitios que renderizan con JavaScript** quedan afuera. El HTML inicial no
  trae los datos. `playwright` ya es devDependency del repo, así que agregar una
  estrategia con navegador es posible sin dependencias nuevas; no está hecho
  porque hoy no hizo falta.
- **Catálogos mayoristas detrás de login** no se relevan, y no se van a relevar:
  hay que respetar el acceso.
- **El discovery sin API key depende de una persona** (o del skill) que llene
  `seeds/candidates.json`. Con `SERPER_API_KEY` o `BRAVE_SEARCH_API_KEY` el
  ciclo mensual queda completamente automático.
- **La lista de sufijos de dominio** (`normalize/domain.ts`) es acotada al
  mercado argentino, no es la Public Suffix List entera.
