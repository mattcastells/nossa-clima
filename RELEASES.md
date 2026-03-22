# Release Guide (Android APK via GitHub Releases)

Este archivo es la referencia oficial para publicar releases de APK.

## Convencion obligatoria de tags

Formato:

`vMAJOR.MINOR.PATCH-bBUILD`

Ejemplos validos:

- `v0.2.1-b4`
- `v0.2.2-b5`
- `v1.0.0-b10`

Reglas:

- `MAJOR.MINOR.PATCH` se copia a `expo.version`.
- `BUILD` se copia a `expo.android.versionCode`.
- `BUILD` siempre debe subir (estrictamente mayor al anterior).
- Borrar tags o releases viejos en GitHub no reinicia `versionCode`.
- No usar tags sin sufijo `-bN`.

## Por que importa

Android solo permite actualizar una APK si la nueva tiene `versionCode` mayor a la instalada.

Si publicas, por ejemplo, `v0.2.1-b1` cuando usuarios ya tienen `b2` o `b3`, la app puede ver una version semantica mas nueva pero no la va a poder instalar encima.

Aunque borres el historial de GitHub Releases, cualquier APK ya instalada sigue teniendo su `versionCode` local. Si queres que la actualizacion desde la app siga funcionando, el siguiente build debe ser mayor al ultimo que ya circulo.

## Flujo oficial de release

1. Elegir el proximo tag siguiendo la convencion.
2. Preparar versionado local:

```bash
npm run release:prepare -- v0.2.1-b5
```

3. Commit de los cambios de version:

```bash
git add app.json
git commit -m "release: v0.2.1-b5"
```

4. Crear y subir tag:

```bash
git tag v0.2.1-b5
git push origin main
git push origin v0.2.1-b5
```

5. Esperar workflow `.github/workflows/android-release.yml`.
6. Verificar en GitHub Release que exista el asset APK con nombre `nossa-clima-v0.2.1-b5.apk`.

Nota: el workflow vuelve a ejecutar `scripts/prepare-android-release.mjs`. El script acepta el caso idempotente donde `app.json` ya coincide con el tag, pero sigue bloqueando cualquier intento de bajar el `BUILD`.

## Migracion a repo privado

El repo fuente (`mattcastells/nossa-clima`) puede hacerse privado sin romper actualizaciones a usuarios,
siempre que se siga el plan de transicion a continuacion.

### Repos involucrados

| Repo | Visibilidad | Proposito |
|---|---|---|
| `mattcastells/nossa-clima` | privado (eventual) | Codigo fuente, CI/CD, APK build |
| `mattcastells/nossa-clima-releases` | **publico** | Solo releases + APK para descarga |

### Por que dos repos

La app llama `GET https://api.github.com/repos/{repo}/releases` sin autenticacion.
GitHub devuelve 404 para repos privados en llamadas sin token.
El APK no puede contener un token (seria reversible).
Solucion: un repo publico dedicado solo para releases.

### Plan de transicion (build-a-build)

**b6 (ya publicado):** Circula con endpoint apuntando a `nossa-clima`.
Usuarios en b5 encuentran b6 ahi y actualizan.

**b7 (primer build con el nuevo endpoint):**
- El workflow publica el APK en AMBOS repos simultaneamente.
- El APK baked-in tiene `EXPO_PUBLIC_APP_UPDATE_GITHUB_REPO=mattcastells/nossa-clima-releases`.
- Usuarios en b5/b6 encuentran b7 en `nossa-clima` (repo viejo) → actualizan → su nueva app ya apunta al repo nuevo.
- Usuarios en b7+ consultan `nossa-clima-releases` (repo nuevo).

**b8 en adelante:**
- Remover el step `Publish to legacy repo (transition bridge)` del workflow.
- El repo fuente ya puede hacerse privado.
- Solo `nossa-clima-releases` recibe releases.

### Checklist de setup (hacer una sola vez, antes de buildear b7)

Los pasos que tenes que hacer vos en GitHub se detallan al final de este archivo.

### Secretos del repo privado necesarios

- `EXPO_PUBLIC_SUPABASE_URL` (ya existe)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (ya existe)
- `EXPO_PUBLIC_APP_UPDATE_GITHUB_REPO` → cambiar a `mattcastells/nossa-clima-releases`
- `RELEASES_REPO_TOKEN` → PAT con permisos `contents: write` sobre `nossa-clima-releases` (nuevo)

## Comprobaciones rapidas antes de publicar

- `git tag --list 'v*-b*' | sort -V | tail`
- Confirmar que el nuevo `BUILD` sea mayor que el ultimo publicado.
- Confirmar que la release no sea `draft` ni `prerelease`.

## Estado actual (Mar 2026)

Tags detectados en el repo:

- `v0.1.0-b1`
- `v0.2.0-b2`
- `v0.2.0-b3`
- `v0.2.1-b1`
- `v0.2.1-b4`
- `v0.2.1-b5`
- `v0.3.0-b6`

Siguiente build recomendado para continuar la linea sin conflictos:

- `v0.3.1-b7` (patch) o `v0.4.0-b7` (minor)

## Pasos de setup para privacidad del repo (hacelos una sola vez)

### 1. Crear el repo publico de releases

En GitHub: **New repository**
- Nombre: `nossa-clima-releases`
- Visibilidad: **Public**
- Sin README, sin licencia, completamente vacio.
- URL resultante: `https://github.com/mattcastells/nossa-clima-releases`

### 2. Crear un Personal Access Token (PAT)

En GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**

Configuracion del token:
- Nombre: `nossa-clima-releases-writer`
- Expiration: No expiration (o 1 year si preferis rotar)
- Resource owner: `mattcastells`
- Repository access: **Only select repositories** → `nossa-clima-releases`
- Permissions → **Contents: Read and write**
- Generar y copiar el token (solo se muestra una vez).

### 3. Agregar el secreto RELEASES_REPO_TOKEN al repo privado

En `https://github.com/mattcastells/nossa-clima` → **Settings → Secrets and variables → Actions → New repository secret**

- Name: `RELEASES_REPO_TOKEN`
- Secret: pegar el token del paso 2.

### 4. Actualizar el secreto EXPO_PUBLIC_APP_UPDATE_GITHUB_REPO

En la misma pantalla de secrets:
- Editar (o crear si no existe) `EXPO_PUBLIC_APP_UPDATE_GITHUB_REPO`
- Value: `mattcastells/nossa-clima-releases`

### 5. Buildear b7 (primer build con el nuevo endpoint)

Con los secretos en orden, hacer el release normal con el tag siguiente (b7).
El workflow va a publicar el APK en **ambos** repos automaticamente.

### 6. Hacer privado el repo fuente (cuando quieras, despues de que b7 circule)

Una vez que los usuarios con b6 se actualizaron a b7 (la app migra sola el endpoint),
podes ir a `https://github.com/mattcastells/nossa-clima` → **Settings → Danger Zone → Change visibility → Make private**.

### 7. Remover el step de transicion del workflow

Abrir `.github/workflows/android-release.yml` y borrar el step llamado
`Publish to legacy repo (transition bridge — remove after b7)`.
Desde ese punto solo `nossa-clima-releases` recibe releases.
