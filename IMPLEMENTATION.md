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
- [x] Implement connections foundation (anchors, snapping, arrows, basic orthogonal routing)
- [x] Implement connection customization floating toolbar / popover:
  - Line stroke color and stroke width
  - Line pattern (solid, dashed, dotted)
  - End markers (none, arrow, reverse arrow, bidirectional)
  - Routing type selection (straight, orthogonal/cornered, curved)
  - Connection text label (centered text badge, double-click inline editor)
- [x] Implement interactive Miro-style connection adjustment handles & waypoints:
  - Waypoints / inflection points data structure on connections
  - Segment midpoint drag handles to create and divert lines (straight & curved)
  - Orthogonal corner drag handles to shift corner positions and add steps
  - Waypoint deletion (double click handle or drag back in-line)
- [x] Implement node snapping, alignment, and fine adjustment (arrow keys)
- [x] Implement basic grouping and layer management (bring forward/backward)
- [x] Implement Copy/Paste within the board

## Phase 5: Real-Time Collaboration & CRDTs
*Enable multi-user collaboration and offline resiliency.*
> **Architectural Note:** Phase 5 establishes the CRDT data foundation and transactional state synchronization. This must precede Phase 6 (collaborative Rich Text, Think Mode) and Phase 7 (Undo/Redo, Revision History) because multi-user undo managers (`Y.UndoManager`), synchronized timers/visibility, and concurrent text editing (`Y.Text`) rely directly on CRDT primitives to avoid architectural rewrites and concurrency issues.
- [x] Integrate CRDT library (e.g., Yjs or Automerge) on Frontend and Backend
- [x] Setup SignalR / WebSockets for real-time state synchronization
- [x] Implement live cursor tracking and presence indicators
- [x] Configure offline fallback using IndexedDB (tied into PWA/CRDT logic)
- [x] Add online/offline status indicator and snackbars

## Phase 6: Advanced Node Types & Think Mode
*Add specific node behaviors and structured collaborative modes.*
*Note: Rich text editing and Think Mode build directly on Phase 5's CRDT primitives and real-time synchronization.*
- [x] Implement rich text editing within nodes
- [x] Build specific node catalogs (UML, Flowcharts, etc.)
- [x] Implement Sticky Notes (colors, author names)
- [x] Implement "Think Mode" (Timers, Visibility toggles, Viewer participation)
- [x] Implement Frames and Pages

## Phase 6.1: Collaboration Fixes, Rich Text Refinements & Structured Nodes
*Fix real-time synchronization edge cases, inline text editing ergonomics, and multi-section dynamic node structures.*
- [x] Fix real-time shape synchronization desync edge cases (prevent stale Yjs map states and external update suppression)
- [x] Enable double-click on shapes to directly initiate inline text editing
- [x] Support rich text formatting (bold, italic, underline, font size) on text selections within shapes
- [x] Implement multi-section structured nodes (e.g., UML Class/Interface) with dynamic height expansion and overflow handling

## Phase 7: Polish, Export, & Revision History
*Finalize features and prepare for production.*
*Note: Undo/Redo and Revision History integrate with Phase 5's CRDT undo manager and document snapshot/update stream.*
- [ ] Implement cross-board Copy/Paste
- [ ] Implement Undo/Redo and backend Revision History snapshots
- [ ] Implement Canvas Exporting (PDF, SVG, PNG, JPEG)
- [ ] Complete full E2E and Integration test suites
- [ ] Finalize Docker deployment docs and TRUENAS Scale instructions
