# OpenDiagrammer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker Image](https://img.shields.io/badge/ghcr.io-tylersmart%2Fopendiagrammer-blue?logo=docker)](https://github.com/TylerSmart/OpenDiagrammer/pkgs/container/opendiagrammer)
[![Publish Docker](https://github.com/TylerSmart/OpenDiagrammer/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/TylerSmart/OpenDiagrammer/actions/workflows/docker-publish.yml)

**OpenDiagrammer** is an open-source, self-hostable collaborative diagramming canvas inspired by Miro and Lucidchart. It empowers teams and individuals to maintain named diagram boards with real-time multiplayer editing, live cursors, offline resilience via CRDTs, structured brainstorm sessions, and granular permission controls.

---

## Features

- **Infinite Canvas & Flexible Drawing**: Create flowcharts, system diagrams, mind maps, and wireframes with customizable shapes, rich text, colors, and connection arrows.
- **Real-Time Multiplayer Collaboration**: Work together simultaneously with live cursor tracking, presence indicators, and instant canvas updates powered by SignalR.
- **Offline-First & Conflict-Free**: Keep diagramming seamlessly without an internet connection. Changes sync automatically upon reconnecting using CRDTs (Yjs).
- **Think Mode**: Facilitate structured team ideation with timers, sticky notes, and brainstorm phases.
- **Role-Based Access Control**: Securely collaborate with project members using fine-grained board permissions (Owner, Admin, Editor, Viewer).
- **Single Sign-On (SSO / OIDC)**: Authenticate with local email/password or connect your external identity provider (Google, Authentik, Keycloak, or Microsoft Entra ID).
- **Exporting & Snapshots**: Export your boards to PNG, SVG, PDF, or JSON board snapshots with complete revision history.
- **Self-Hostable Anywhere**: Packaged as a unified, production-ready multi-arch Docker container (`linux/amd64` and `linux/arm64`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [Angular 22](https://angular.dev/), TypeScript, [Yjs](https://yjs.dev/) (CRDTs), HTML5 Canvas & SVG |
| **Backend** | [ASP.NET Core 10](https://dotnet.microsoft.com/), SignalR, [Scalar](https://scalar.com/) OpenAPI |
| **Data & ORM** | [Microsoft SQL Server](https://www.microsoft.com/sql-server), Entity Framework Core |
| **Packaging** | Docker, Docker Compose, Multi-Arch Container Images via GitHub Actions |

---

## Quick Start (Docker)

You can launch OpenDiagrammer in seconds using Docker Compose:

```yaml
name: open-diagrammer-prod

services:
  api:
    image: ghcr.io/tylersmart/opendiagrammer:latest
    container_name: open-diagrammer-api
    restart: unless-stopped
    ports:
      - "8580:8080"
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_HTTP_PORTS: 8080
      ConnectionStrings__DefaultConnection: "Server=sqlserver;Database=OpenDiagrammer;User Id=sa;Password=YourStrongPassword123!_MustIncludeCaps;TrustServerCertificate=True;"
      Authentication__Jwt__Secret: "ReplaceWithAStrongSecretKeyAtLeast32CharactersLong!"
    depends_on:
      sqlserver:
        condition: service_healthy

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: open-diagrammer-sqlserver
    restart: unless-stopped
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "YourStrongPassword123!_MustIncludeCaps"
      MSSQL_PID: "Developer"
    volumes:
      - sqlserver_data:/var/opt/mssql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrongPassword123!_MustIncludeCaps' -C -Q 'SELECT 1' -b -o /dev/null",
        ]
      interval: 5s
      timeout: 5s
      retries: 24
      start_period: 20s

volumes:
  sqlserver_data:
```

Run:

```bash
docker compose up -d
```

Open `http://localhost:8580` in your web browser.

---

## Documentation

For comprehensive guides on deployment, configuration, backups, and development, please refer to our dedicated documentation:

- 🐳 **[Production Docker Deployment Guide](docs/deployment/docker-deployment.md)** — Step-by-step production deployment with reverse proxies (Nginx, Caddy, Traefik, Cloudflare Tunnel), automated backups, and environment tuning.
- 🚀 **[TrueNAS Scale Deployment Guide](docs/deployment/truenas-scale.md)** — Native Docker Compose setup for TrueNAS Scale (Electric Eel 24.10+) and Dragonfish (24.04), ZFS datasets, and automated snapshots.
- 🔐 **[OIDC & SSO Authentication Guide](docs/deployment/oidc-authentication.md)** — Configure Single Sign-On with Google OAuth 2.0, Authentik, Keycloak, or Microsoft Entra ID.
- 🛠️ **[Contributing & Development Guide](CONTRIBUTING.md)** — Workstation setup (.NET 10 & Angular 22), database migrations (EF Core), code styling, test execution, and pull request guidelines.

---

## Contributing

Contributions of any kind are welcomed and appreciated! Please see our **[Contributing Guide](CONTRIBUTING.md)** for detailed instructions on getting started with local development and submitting pull requests.

---

## License

OpenDiagrammer is free and open-source software licensed under the **[MIT License](LICENSE)**.
