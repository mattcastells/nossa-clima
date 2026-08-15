---
name: nossa-clima-feature
description: Cómo se agrega o modifica una funcionalidad en la app Nossa Clima, capa por capa. Usar antes de tocar Supabase (migraciones, columnas, RLS), src/services, src/features/*/hooks, esquemas zod o al agregar una pantalla nueva. Incluye el orden de capas, el patrón de compatibilidad hacia atrás y los checks obligatorios.
---

# Agregar funcionalidad — Nossa Clima

Expo + expo-router + Supabase + TanStack Query + react-hook-form + zod + zustand.
Tests con vitest.

---

## Orden de capas (siempre de abajo hacia arriba)

```
1. supabase/migrations/     SQL: columnas, tablas, RLS
2. src/types/db.ts          la interfaz TypeScript de la fila
3. src/services/<x>.ts      llamadas a Supabase. Sin React acá
4. src/features/<x>/hooks   useQuery / useMutation + invalidaciones
5. src/features/<x>/schemas zod, para lo que entra por formulario
6. app/… o src/features/…   la UI
```

No saltear capas. Nada de `supabase.from(...)` dentro de un componente: siempre pasa
por `src/services`.

---

## Base de datos

**Nombre del archivo:** `YYYYMMDDNNNN_descripcion_corta.sql` en
`supabase/migrations/`. Mirá el último archivo del directorio y seguí la serie.

**Todo idempotente**, porque estas migraciones se aplican a mano:

```sql
alter table public.quotes
add column if not exists technician_notes text;
```

**RLS obligatorio en tablas nuevas.** El patrón de este repo son cuatro políticas
por tabla, `user_id = auth.uid()`:

```sql
alter table public.mi_tabla enable row level security;

create policy "mi_tabla_select_own" on public.mi_tabla
  for select using (user_id = auth.uid());
create policy "mi_tabla_insert_own" on public.mi_tabla
  for insert with check (user_id = auth.uid());
create policy "mi_tabla_update_own" on public.mi_tabla
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mi_tabla_delete_own" on public.mi_tabla
  for delete using (user_id = auth.uid());
```

Excepción: `stores` e `items` son **catálogo compartido** entre usuarios, con
auditoría por `updated_by` y trigger `set_shared_catalog_audit_fields`
(`202603160003_shared_catalogs_and_audit.sql`). Si tocás esas dos, seguí ese patrón,
no el de arriba.

**Archivar, no borrar.** Las filas referenciadas por trabajos tienen `archived_at` y
FKs `on delete restrict`. El borrado duro falla y además rompería informes ya
emitidos. Los ítems de un trabajo guardan snapshot del nombre
(`item_name_snapshot`, `service_name_snapshot`) justamente para eso.
Para archivar: `update ... set archived_at = now()`, y el `list*` filtra
`.is('archived_at', null)`.

---

## Compatibilidad hacia atrás (importante en este repo)

Las migraciones se aplican a mano en Supabase, así que la app puede correr contra un
esquema viejo. Los servicios degradan en vez de romper, con
`src/services/supabaseCompatibility.ts`:

```ts
const { data, error } = await supabase.from('quotes').select('*');
if (error) {
  if (!isMissingSupabaseColumnError(error, 'technician_notes')) throw error;
  // reintentar sin la columna, o devolver un fallback razonable
}
```

Ejemplos ya escritos: `upsertQuote` con `cancelled_at`
(`src/services/quotes.ts:198`), `listServices` con `archived_at`
(`src/services/services.ts:35`), `listItems` con `archived_at`
(`src/services/items.ts:15`).

Regla: **toda columna nueva que un `select`/`upsert` existente vaya a tocar necesita
su fallback.** Si no, la app deja de andar hasta que alguien corra el SQL.

---

## Servicios

`src/services/<dominio>.ts`. Funciones sueltas, tipadas, sin React.

```ts
export const listAlgo = async (): Promise<Algo[]> => {
  const { data, error } = await supabase.from('algos').select('*')
    .is('archived_at', null).order('name');
  if (error) throw error;
  return data;
};
```

Devolver siempre tipos de `src/types/db.ts`. Si el shape es una composición
(join, agregado), definí la interfaz en el propio servicio y exportala —
`QuoteDetail` y `QuoteListItem` en `src/services/quotes.ts` son el modelo.

---

## Hooks

`src/features/<dominio>/hooks.ts`. Query keys en array, y **toda mutación invalida
lo que corresponde**:

```ts
export const useArchiveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items-with-stats'] });
    },
  });
};
```

Si una mutación afecta un trabajo, invalidá también `['quote-detail', quoteId]` y
`['quotes']`. Olvidarse de una invalidación se ve como "no se actualizó".

---

## Formularios

`react-hook-form` + `zodResolver`, esquema en `src/features/<x>/schemas.ts`.
Mensajes de validación en español y accionables.

```ts
export const algoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  cantidad: z.coerce.number().gt(0, 'Cantidad invalida'),
  notas: z.string().trim().optional(),
});
```

Campos opcionales vacíos se guardan como `null`, no como `''`:
`values.notas?.trim() ? values.notas.trim() : null`.

Si el formulario se guarda desde afuera (un botón del contenedor), exponé un handle
con `useImperativeHandle` — ver `QuoteForm` / `QuoteFormHandle`.

---

## Tests

Vitest, `__tests__/` al lado de lo que prueban. Se testea la **lógica pura**:
esquemas zod, cálculos de precios, parseo, formateo, normalización.
No hay tests de componentes.

Si escribís una función de cálculo, normalización o parseo, va con test.
Ver `src/features/quotes/__tests__/workSections.test.ts` y
`src/features/quotes/materialPricing.ts`.

---

## Antes de terminar, siempre

```bash
npm run lint
npm run typecheck
npm test
```

Los tres tienen que pasar. Si la tarea tocó UI, además abrila en claro y en oscuro
(ver la skill `nossa-clima-ui`).

Si la tarea agregó una migración, decilo explícitamente al reportar: **hay que
correr el SQL en Supabase a mano**, no se aplica solo.

---

## Mapa rápido del repo

| Ruta | Qué hay |
|---|---|
| `app/(tabs)/quotes/` | Trabajos: lista, alta, detalle, +servicio, +material |
| `app/(tabs)/items/`, `services/`, `stores/` | Catálogo (el `CatalogSwitcher` los une) |
| `app/(tabs)/calendar.tsx` | Agenda |
| `app/(tabs)/assistant.tsx` | Asistente IA (Edge Function `assistant-chat`) |
| `src/features/quotes/newQuote/` | Los hooks del alta de trabajo, separados por dominio |
| `src/features/quotes/exportPdf.ts` | Informe PDF → skill `nossa-clima-informe` |
| `src/components/AppScreen.tsx` | Layout, encabezado y tab bar de toda la app |
| `src/theme/index.ts` | Tokens claro/oscuro → skill `nossa-clima-ui` |
| `docs/` | Rediseño UI, plan de feedback, setup de release |

Vocabulario: en la base la tabla se llama `quotes`, pero **en la UI siempre es
"trabajo"**, nunca "presupuesto".
