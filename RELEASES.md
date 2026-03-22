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
