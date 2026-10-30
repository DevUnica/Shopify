# AGENTS.md

## Contexto del repo

- Aloja el tema Shopify **Hyper 1.4.0** (FoxEcom) de Distribuidora La Única, tienda **Centro** (`distrilaunica.com.co`). La raíz real del tema es `theme_export__distrilaunica-com-co-ajuste-colegio-bolivar__29OCT2026-0914am/`; el `.zip` del mismo nombre es la exportación base, no lo edites.
- La tienda hermana **Sur** (`sur.distrilaunica.com.co`) tiene su propio export. No subas este tema a Sur: sus ajustes referencian imágenes `shopify://shop_images/...` de Centro.
- El repo también sirve imágenes a producción: el carrusel "Marcas favoritas" carga `raw.githubusercontent.com/DevUnica/Shopify/main/SVG/*.webp`. Un push a `main` se refleja al instante en la tienda. No borres ni renombres `SVG/` sin actualizar antes las URLs en `sections/footer-group.json` (hoy los 24 `.webp` están borrados en el working tree sin commit: no confirmes ese borrado con `git add -A`).

## Comandos y verificación

- No hay `package.json`, build, tests, linter, CI ni `shopify.theme.toml`, y Shopify CLI no está instalado. No inventes `npm test`, `shopify theme dev` ni similares.
- Validación mínima antes de publicar (falla si un JSON quedó mal escapado):

  ```powershell
  Get-ChildItem templates,sections,config -Recurse -Filter *.json | % { Get-Content $_.FullName -Raw | ConvertFrom-Json | Out-Null }
  ```

- La verificación real es la vista previa en Shopify. Para publicar, el zip debe llevar `assets/`, `config/`, etc. en la raíz (sin carpeta contenedora) y rutas con `/`; `Compress-Archive` de PS 5.1 escribe `\`, así que usa ZipFile:

  ```powershell
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $root=(Get-Location).Path; $z=[IO.Compression.ZipFile]::Open("$root\..\tema-centro.zip",'Create')
  Get-ChildItem -Recurse -File | % { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,$_.FullName,$_.FullName.Substring($root.Length+1).Replace('\','/')) }
  $z.Dispose()
  ```

  Luego súbelo desde Admin > Temas.

## Dónde está el contenido (no obvio)

- Gran parte del contenido y los estilos vive **dentro de JSON**, en bloques `custom-liquid` y `custom_css`, no en los `.liquid`/`.css`. Ejemplos: `sections/footer-group.json` (carrusel "Marcas favoritas", ~24 KB de HTML/CSS/JS), `templates/404.json` (el `main-404` está `disabled`), `templates/product.json` y `product.colegio-bolivar.json` (bloque de SKU/código), `layout/theme.liquid` (widget Addi y ocultar WhatsApp `#wa` al abrir el carrito).
- El carrusel de marcas **no** usa `sections/brand-logos.liquid` ni `assets/section-brand-logos.css` (sección stock sin usar en plantillas). Busca `.marcas-favoritas` en `sections/footer-group.json`.
- Los JSON son de una sola línea y contienen HTML/CSS escapado (`\n`, `\"`, `\/`). Para cambios grandes usa un script (Node está disponible) y valida después; no reformatees el archivo completo.
- `sections/{header,footer,overlay}-group.json` son secciones globales que renderiza `layout/theme.liquid`; no son plantillas de página.
- `templates/collection.<sufijo>.json` / `product.<sufijo>.json`: el sufijo se asigna en el admin y no siempre coincide con el handle (`collection.geometrico.json` ↔ `juego-geometrico`; `juegos-didacticos` ↔ `juegos-didactos`; `termos-y-portas` ↔ `termos-y-portacomidas`). No renombres asumiendo mapeo automático.
- Los `{% schema %}` usan claves `t:...`; si creas una sección, agrega sus claves en los `locales/*.schema.json` (existen los 6 idiomas).
- Ajuste actual del colegio: `templates/collection.colegio-bolivar.json` (banners `BANNER_*_BOLIVAR`, grilla de 5 columnas) y `templates/product.colegio-bolivar.json` (hoy idéntico a `product.json`).

## Selector de sede (Centro/Sur)

- `snippets/sede-selector.liquid` se renderiza al final de `layout/theme.liquid` en todas las páginas. Es el mismo snippet en ambas tiendas; solo cambia `FALLBACK_STORE` (`'centro'` aquí, `'sur'` en Sur).
- Cookie `dlu_selected_store` (dominio `.distrilaunica.com.co`, 30 días). Para probar: `?choose_store=1`; API manual `window.DLUStoreSelector.open()`.
- Conserva el formato actual (una propiedad por línea, con líneas en blanco). Ojo: `--dlu-navy` hoy vale `#df408a` (rosa) aunque los comentarios digan azul `#1b3c73`; confirma antes de "corregirlo".

## Assets, marca y codificación

- `assets/` solo tiene JS/CSS/SVG de iconos; las fotos y logos son `shopify://shop_images/...` del admin (o el `SVG/` de GitHub). Para añadir una imagen hay que subirla a Files y usar el nombre exacto.
- Paleta propia: `#1881c1`, `#1b3c73`, `#f7d52c`, `#7fb32c`, `#df408a`, `#f7a82c`. Tipografías: Lapsus Pro (su `@font-face` no tiene `src`, cae a Arial Rounded MT Bold) y Varela Round en "Marcas favoritas".
- El copy en español está hardcodeado en JSON/liquid; editar `locales/*.json` no lo cambia. Los archivos son UTF-8 sin BOM y LF: no los reescribas con `Set-Content`/`Out-File` de PowerShell 5.1 (rompen tildes o agregan BOM); usa las herramientas de edición o `[IO.File]::WriteAllText` con `UTF8Encoding($false)`.
