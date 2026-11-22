# 🎄 La Playlist de Navidad · Amigos 2026

Web para que cada invitado elija sus 3 canciones favoritas para la playlist de la fiesta.

- `index.html`: web estática (buscador de canciones con iTunes Search API, envío y rankings).
- `apps-script/Code.gs`: backend en Google Apps Script. Guarda en el Sheet "Playlist Navidad Amigos 2026" (hoja `Canciones`) y devuelve solo estadísticas agregadas.

Las canciones con estado "Pendiente" se añaden a la lista colaborativa de Spotify y se marcan como "Añadida".
