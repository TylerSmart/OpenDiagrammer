# OpenDiagrammer - Implementation Plan

This document synthesizes the requirements from the `PRD.md` and `TODO.md` into a comprehensive, step-by-step implementation plan.

## Phase 1: Project Initialization & Open Source Docs
*Setup the core foundation of the repository and both projects.*
- [x] Create `README.md` (Summary, Versioning, Test Statuses, Installation, Screenshots, Licenses)
- [x] Create `LICENSING.md`
- [x] Create `CONTRIBUTING.md`
- [x] Setup production Docker configuration (`Dockerfile` for UI/API, `docker-compose.prod.yml`)
- [x] Initialize .NET 10 Web API project in the `.slnx` solution
- [x] Configure Database & EF Core inside the API
- [x] Scaffold Angular v22 workspace (Zoneless, Signals, Material M3, PWA)
- [x] Setup development Docker configuration (SQL Server only via `docker-compose.yml`, API and Client run manually)

## Phase 2: Backend Architecture & Auth API
*Establish the data models and authentication mechanisms.*
- [x] Implement local JWT authentication
- [x] Setup generic OIDC/OAuth2 integration (for providers like Google or Microsoft)
- [x] Define Board, Member, and Role entity models (Owner, Admin, Editor, Viewer)
- [x] Implement CRUD APIs for Boards and Board Members
- [x] Setup basic test coverage for APIs

## Phase 3: Frontend Foundation & Board Management
*Build out the initial UI and connect it to the backend.*
- [x] Setup Angular routing structure (Login, Dashboard, Board View)
- [x] Implement Light/Dark theme syncing with system settings
- [x] Build Login/Register and Auth flow UI
- [x] Build Dashboard for Board management (Create/Delete/List)
- [x] Build Board Settings and Role assignment modals

## Phase 4: Core Canvas & Diagramming (Frontend)
*Implement the drawing canvas and basic diagramming tools.*
- [x] Implement infinite canvas with zoom/pan controls and grid/dot backgrounds
- [x] Implement shape rendering, selection, and resizing
- [x] Implement connections (lines, arrows, anchors, routing)
- [ ] Implement node snapping, alignment, and fine adjustment (arrow keys)
- [ ] Implement basic grouping and layer management (bring forward/backward)
- [ ] Implement Copy/Paste within the board

## Phase 5: Real-Time Collaboration & CRDTs
*Enable multi-user collaboration and offline resiliency.*
- [ ] Integrate CRDT library (e.g., Yjs or Automerge) on Frontend and Backend
- [ ] Setup SignalR / WebSockets for real-time state synchronization
- [ ] Implement live cursor tracking and presence indicators
- [ ] Configure offline fallback using IndexedDB (tied into PWA/CRDT logic)
- [ ] Add online/offline status indicator and snackbars

## Phase 6: Advanced Node Types & Think Mode
*Add specific node behaviors and structured collaborative modes.*
- [ ] Implement rich text editing within nodes
- [ ] Build specific node catalogs (UML, Flowcharts, etc.)
- [ ] Implement Sticky Notes (colors, author names)
- [ ] Implement "Think Mode" (Timers, Visibility toggles, Viewer participation)
- [ ] Implement Frames and Pages

## Phase 7: Polish, Export, & Revision History
*Finalize features and prepare for production.*
- [ ] Implement cross-board Copy/Paste
- [ ] Implement Undo/Redo and backend Revision History snapshots
- [ ] Implement Canvas Exporting (PDF, SVG, PNG, JPEG)
- [ ] Complete full E2E and Integration test suites
- [ ] Finalize Docker deployment docs and TRUENAS Scale instructions
