# OpenDiagrammer

OpenDiagrammer is an open-source diagramming tool similar to Miro and Lucidchart. It allows users to maintain named boards that can be shared and collaborated on in real-time. Whether you're building flow charts, mind maps, or UML diagrams, OpenDiagrammer provides an infinite canvas to bring your ideas to life.

## Features

- **Real-Time Collaboration**: Work together with others simultaneously with live cursors and updates.
- **Offline Capabilities**: Keep working even when your internet connection drops. Changes seamlessly sync when reconnected using CRDTs.
- **Customizable Nodes & Connections**: Add rich text, colors, and specific shapes to your diagrams.
- **Think Mode**: Enforce structured collaboration sessions using sticky notes and timers.
- **Role-Based Access Control**: Securely share boards with specific permissions (Owner, Admin, Editor, Viewer).
- **Exporting**: Export your boards to PDF, SVG, PNG, or JPEG.

## Versioning

*(To be implemented - Semantic Versioning tags will appear here)*

## Test Statuses & Coverage

*(To be implemented - CI/CD badges for Build Status and Test Coverage will appear here)*

## Installation / Deployment

OpenDiagrammer is designed to be easily deployed anywhere using Docker, including environments like TRUENAS Scale.

### Quick Start (Docker)

*(Deployment commands and `docker-compose` instructions will be provided here once the Docker image is finalized)*

## Local development

The API and Angular client run **on your machine** (Visual Studio F5 with hot reload). Docker is used only for SQL Server.

### Prerequisites

1. [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) with **Linux containers** (WSL2 backend).
2. Visual Studio with the solution's multiple startup projects (API + client), same as today.
3. Node.js for the Angular client (unchanged).

### First-time and everyday F5

1. Start Docker Desktop and wait until it is running.
2. Press F5 in Visual Studio.

A Debug build from Visual Studio runs `scripts/ensure-local-infra.ps1`, which starts the containers and creates the `OpenDiagrammer` database. The first SQL Server start can take about 30 seconds. Later F5s are fast if the containers are already healthy.

If Docker Desktop is not running, the build fails with a message to start it.

### Manual start (Cursor, CLI, or without Visual Studio)

From the repository root:

```powershell
.\scripts\ensure-local-infra.ps1
```

Then run the API (`ASPNETCORE_ENVIRONMENT=Local`) and the Angular client as usual.

### Local services

| Service | Host endpoint | Notes |
|---|---|---|
| SQL Server | `localhost,14333` | Database `OpenDiagrammer`. User `sa`, password `OpenDiagrammer_Local_Dev_1`. Port 14333 avoids a local SQL Server on 1433. |

SSMS / Azure Data Studio: server `localhost,14333`, SQL authentication, database `OpenDiagrammer`.

### Troubleshooting

- **Docker is not available** — Start Docker Desktop. Use Linux containers, not Windows containers.
- **WSL not running** — Open Docker Desktop and wait until the engine is ready; restart WSL if needed (`wsl --shutdown`, then start Docker again).
- **Port already in use** — Another process is bound to 14333, 6379, 9000, or 9001. Stop that process or change the host ports in `docker-compose.yml` and `appsettings.Local.json` together.
- **`--wait` timeout / SQL healthcheck failing** — First boot can be slow. Re-run `.\scripts\ensure-local-infra.ps1`. Check `docker compose ps` and `docker compose logs sqlserver`.

Do **not** point a Local debug session at Development AWS resources. Local and Development share the same configuration keys; only the endpoints differ.

## Screenshots

*(Screenshots of the UI, Light/Dark modes, and the collaborative canvas will be added here)*

## Licensing

OpenDiagrammer is open-source software. See the [LICENSING.md](LICENSING.md) file for details.

## EF Core

Schema lives in `OpenDiagrammerDbContext` (`OpenDiagrammer.Data`). Change the model, then add a migration and commit it. Local F5 applies pending migrations automatically; other environments should run `database update` (or an equivalent deploy step) instead of relying on startup.

Restore the EF tool once per machine:

```powershell
dotnet tool restore
```

All commands below are from the repository root.

**Add a migration** after changing entities or configurations:

```powershell
dotnet ef migrations add <MigrationName> --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
```

**Apply migrations** to the database in `appsettings.Development.json` (or the current environment):

```powershell
dotnet ef database update --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
```

**Revert the last migration** (database and then delete the migration files if you also want them gone):

```powershell
dotnet ef database update <PreviousMigrationName> --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
dotnet ef migrations remove --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
```

`migrations remove` only works if the last migration has not been applied, or after you have rolled the database back. List applied migrations with:

```powershell
dotnet ef migrations list --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
```

SQL scripts (for reviewing or applying without the CLI):

```powershell
dotnet ef migrations script --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API --output OpenDiagrammer.sql
```
