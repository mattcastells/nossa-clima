-- Feedback de usuarios (2026-08): separar los tres tipos de nota de un trabajo
-- y sumar el tecnico encargado al informe.
--
-- quotes.notes se mantiene con el mismo nombre y pasa a significar SOLO el
-- resumen que se imprime en el informe. Renombrarla obligaria a tocar el
-- asistente, los seeds y la Edge Function sin ninguna ganancia.
--
--   notes             -> resumen del trabajo. SE IMPRIME en el informe.
--   technician_notes  -> notas privadas del tecnico. NUNCA se imprimen.
--                        Se ven al abrir el trabajo, en la tarjeta de la
--                        agenda y en la notificacion del turno.
--   client_notes      -> datos de acceso del cliente (timbre, piso, quien
--                        recibe). SE IMPRIMEN en el bloque de cliente.
--   technician_name   -> tecnico encargado. SE IMPRIME en el bloque de
--                        cliente. Se autocompleta con el nombre del perfil
--                        dueno del trabajo, pero es editable por trabajo.

alter table public.quotes
add column if not exists technician_notes text;

alter table public.quotes
add column if not exists client_notes text;

alter table public.quotes
add column if not exists technician_name text;

comment on column public.quotes.notes is
  'Resumen del trabajo. Se imprime en el informe PDF bajo el titulo RESUMEN.';
comment on column public.quotes.technician_notes is
  'Notas privadas del tecnico. No se imprimen nunca en el informe PDF.';
comment on column public.quotes.client_notes is
  'Datos de acceso del cliente (timbre, piso, quien recibe). Se imprimen en el bloque de cliente.';
comment on column public.quotes.technician_name is
  'Tecnico encargado del trabajo. Se imprime en el bloque de cliente.';

-- Las politicas RLS de quotes ya cubren estas columnas: son por fila
-- (user_id = auth.uid()), no por columna. No hace falta tocarlas.
