---
name: implement-next-step
description: Identifies and implements the next uncompleted task in IMPLEMENTATION.md, then tests, marks, and commits the completed work.
---

# Implement Next Step

This skill is used to identify and implement the next task in the project's implementation plan through verification and commit.

## Procedure

1. **Read the Implementation Plan**: Open and read the `IMPLEMENTATION.md` file in the root of the repository.
2. **Identify the Next Task**:
    - Look for the first task in the list that is not marked as completed (i.e., it has `[ ]` instead of `[x]`).
    - The tasks are organized into Phases. Find the first uncompleted task within the current or next phase.
3. **Analyze the Task**:
    - Understand the scope of the task.
    - Determine which files or components need to be created or modified.
    - Check if there are any dependencies for this task (e.g., other tasks that must be completed first).
4. **Report the Task**:
    - State clearly what the next task is.
    - Provide a brief plan of action for implementing it.
5. **Implement the Confirmed Task**: After the user confirms, implement the task in the repository, following its existing conventions and keeping changes scoped to the task.
    - If changes are made to entity models, relationships, or configurations in `OpenDiagrammer.Data`, always generate and apply a corresponding EF Core migration:
      ```powershell
      dotnet ef migrations add <DescriptiveName> --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
      dotnet ef database update --project OpenDiagrammer.Data --startup-project OpenDiagrammer.API
      ```
    - Maintain lean controllers: business logic, authorization rules, and persistence operations must be encapsulated in services defined in `OpenDiagrammer.Core`, keeping controllers as thin HTTP adapters.
6. **Add and Run Relevant Tests**:
    - Add or update tests for the new or changed behavior when applicable, using the repository's existing test patterns.
    - After every implementation iteration, build the entire application and run the full test suites, covering all production projects (including the API and client), not only the files touched in that iteration. Use the repository's documented build and test commands.
    - Resolve failures caused by the implementation, then repeat the full build and test suites before starting another implementation iteration. Do not treat targeted tests alone as full verification.
    - If a required build or test cannot be run or does not pass, report the blocker and do not claim the application is verified.
7. **Mark the Task Complete**: Only after the entire application builds successfully and all applicable full test suites pass, change that task's checkbox in `IMPLEMENTATION.md` from `[ ]` to `[x]`. Do not mark it complete if implementation or required verification is still blocked.
8. **Commit the Changes**: After successful verification and marking the task complete, commit the completed task's changes on the currently checked-out branch. Do not create or switch branches. Stage only files related to this task, preserving unrelated pre-existing working-tree changes. If verification or the commit is blocked, explain why and leave the changes intact.

## Example

**IMPLEMENTATION.md content:**
```markdown
## Phase 1: Project Initialization & Open Source Docs
- [x] Create `README.md`
- [ ] Setup Docker configuration (`Dockerfile` for UI/API, `docker-compose.yml`)
```

**Agent Response:**
"The next task in the implementation plan is: **Setup Docker configuration (`Dockerfile` for UI/API, `docker-compose.yml`)** from Phase 1.

I will need to:
1. Create a `Dockerfile` for the `OpenDiagrammer.API` project.
2. Create a `Dockerfile` for the `OpenDiagrammer.Client` project.
3. Create a `docker-compose.yml` file to orchestrate both containers and the database."
