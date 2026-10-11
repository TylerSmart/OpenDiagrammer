# OpenDiagrammer - Agent Rules & Repository Guidelines

These guidelines apply to all AI agents and contributors working in the OpenDiagrammer repository.

---

## 1. Entity Framework Core & Database Migrations

Whenever changes are made to entity models, entity configurations, relationships, indexes, or properties in the `OpenDiagrammer.Data` project:

1. **Generate a Migration**:
   Always create an EF Core migration using a descriptive name:
   ```powershell
   dotnet ef migrations add <DescriptiveMigrationName> --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
   ```
2. **Apply the Migration**:
   Update the active database to ensure the schema changes are tested and immediately available:
   ```powershell
   dotnet ef database update --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
   ```
3. **Commit Migration Files**:
   Include the generated migration files in `OpenDiagrammer.Data/Migrations/` in the same commit as the entity and configuration changes. Never leave data model changes without a corresponding migration.
4. **Automatic Startup Migration**:
   The API automatically applies pending migrations on startup when running against relational databases (like SQL Server in Docker or local dev) via `db.Database.Migrate()`. In-memory databases used for testing are skipped.

---

## 2. Backend Coding Standards

- **Architecture Layers & Responsibilities**:
  - `OpenDiagrammer.Core`: Domain models, enums, business logic, authorization rules, and service interfaces.
  - `OpenDiagrammer.Data`: DbContext, EF Core configurations, entity definitions, migrations, and data service implementations.
  - `OpenDiagrammer.Infrastructure`: Third-party service implementations, external APIs, JWT and OIDC services.
  - `OpenDiagrammer.API`: ASP.NET Core controllers, DTOs, endpoint routing, middleware, and HTTP response mapping.
- **Lean Controllers (Strict Rule)**:
  - Controllers must remain thin HTTP adapters. A controller's responsibilities are strictly limited to:
    1. Receiving and binding HTTP requests and DTOs.
    2. Invoking application/domain services defined in `OpenDiagrammer.Core`.
    3. Translating service results into HTTP responses (status codes, ProblemDetails, cookies/headers).
  - Controllers MUST NEVER contain:
    - Direct `DbContext` queries, LINQ data access, or raw persistence operations.
    - Business logic, authorization/permission rules, or entity state mutation loops.
  - All database operations, permission checks, and entity lifecycles must be encapsulated within dedicated services implementing interfaces defined in `OpenDiagrammer.Core`.
- **Code Style & Formatting**:
  - Run `dotnet csharpier format .` before committing changes.
  - Adhere to nullable reference types (`#nullable enable`).
  - Use records for DTOs and immutable values.

---

## 3. Testing & Verification

- Before committing any changes, run the full test suite:
  - Backend: `dotnet test` (all unit and integration tests must pass).
  - Client: `npm test -- --no-watch` inside `OpenDiagrammer.Client`.
- Verify production build succeeds: `npm run build:production`.

---

## 4. Frontend Guidelines

For Angular and TypeScript development inside `OpenDiagrammer.Client`, refer directly to [`OpenDiagrammer.Client/AGENTS.md`](OpenDiagrammer.Client/AGENTS.md).
