# 🛡️ CyberNews Portal

Portal web de noticias de ciberseguridad actualizado automáticamente con fuentes de España, Europa y el mundo.

## Características

- **25 fuentes RSS** de ciberseguridad organizadas por región
- **Actualización automática** cada vez que se abre la página
- **Filtros por región**: España, Europa y Mundo
- **Diseño responsive** adaptado a móvil y escritorio
- **Sin backend** — funciona como página estática usando proxies CORS públicos
- **Caché local** para carga instantánea

## Fuentes

### 🇪🇸 España
- INCIBE / INCIBE-CERT 
- HackPlayers
- Una al Día (Hispasec)
- CyberSecurity News ES

### 🇪🇺 Europa
- ENISA
- EU CERT
- The Register - Security
- Graham Cluley
- Infosecurity Magazine
- Computer Weekly Security

### 🌍 Mundo
- The Hacker News
- BleepingComputer
- Krebs on Security
- SecurityWeek
- Dark Reading
- Naked Security (Sophos)
- Schneier on Security
- CISA Alerts
- CSO Online
- Recorded Future (The Record)
- SC Magazine

## Uso

Abrir `index.html` en un navegador o servir con cualquier servidor local:

```bash
# Con Python
python -m http.server 8080

# Con Node.js
npx serve .

# Con VS Code
# Usar la extensión Live Server / GoLive
```

## Estructura

```
├── index.html    # Página principal
├── styles.css    # Estilos (paleta inspirada en INCIBE)
├── app.js        # Lógica de carga y parseo de feeds RSS
└── README.md
```

## Notas

- Algunas fuentes pueden no cargar si los proxies CORS públicos están saturados o si el sitio origen los bloquea.
- Los logs de carga se pueden ver en la consola del navegador (F12).
- Las noticias se cachean en `localStorage` para evitar peticiones innecesarias.
