# OpenDiagrammer - PRD

OpenDiagrammer will be an open-source diagramming tool similar to Miro and Lucidchart. It will allow users to maintain named boards that can be shared and collaborated on with other users. The purpose of the boards can be for anything like flow charts, mind maps, or UML diagrams.

## Requirements

### Technical

#### Deployment

The application should be a Docker application that can be deployed anywhere, such as a TRUENAS Scale device. The project should contain documentation on how it should be built and deployed.

#### Persistence

The application should support persistence via a database. Due to the nature of the deployment, the database should be free and lightweight. Ideally the database will be packaged as part of the Docker application.

#### Front End

The application should be built with the latest offerings of Angular (Angular v22 at the time of writing) for the front end. The application should utilize a zoneless construction with signals where possible. The app should also utilize Angular Material M3. The app should be a PWA that can be installed onto devices for offline usage. 

#### Back End

The application should be built with the latest LTS version of .NET (.NET 10 at the time of writing). The back end will support authentication (supporting local accounts via JWT and an optional generic OIDC/OAuth2 integration for easy self-hosting), basic CRUD operations for managing boards, real-time collaboration, and more.

#### Testing

An adequate test suite should exist for the front end and back end. This includes unit, integration, and end to end tests.

### Functional

#### Boards

All diagrams with be contained within a board. The board has one owner and zero to many members. Members must be granted a role. Boards are named, and can optionally be given a description. The board can be configured with customization options.

#### Diagramming

Diagramming happens inside of a board. A board is comprised of customized nodes which can be related with customized connections.

#### Real Time Collaboration

Any users who are viewing the board should be aware who is viewing it. Users can also see what other users are doing in real time like typing or placing nodes, or connecting nodes. Users should also be able to view where other user cursors are, with the option of quickly toggling this functionality.

#### Offline Usage

The app should support working offline. A user should be able to view and edit boards with no internet connection. The app should indicate if the user is connected or in an offline mode with a persistent status. When a user changes between offline and online states, a snackbar should be shown with the new state. To handle conflicts when multiple users edit offline and reconnect, the application should utilize CRDTs (Conflict-free Replicated Data Types) to seamlessly merge changes without losing user intent.

#### App Theme

The app should support different themes. To start, we will develop and light theme and a dark theme that optionally follow the user's system theme. We will plan to implement color options in the future.

#### Roles

A board owner has complete control of the board. They can do anything an admin can. A board owner can control all other member roles, can delete the board, or transfer ownership. A board admin can control any other member roles, except the owner, can control board modes, and can do anything an editor can. A board editor can make edits to the board. A board viewer can view the board.

#### Diagram Nodes

Diagram nodes are the different shapes that can be inserted into a diagram from the catalog. They are categorized into different types (i.e. UML, Flowchart, Shapes, Arrows, Text, etc.). Shapes can be resized (either with uniform or non-uniform scaling, and optionally extending both sides at the same time to keep it centered). Shapes can be given different colors (The background color(s) and border color should be complementary.) from a given selection, but the default is just a black border with transparent background. The user should be able to bring shapes forward (and directly to the top) and backwards (and directly to the bottom). Some nodes should support entering text (a basic node like a rectangle might allow them to fill the shape with text, while a more complex node like a UML Class might have a place for a title, properties, and methods. Some nodes may support text being out the side, like a bracket. Other nodes may support text being in or along it, like a line (whether straight, angles, curved, etc.).). Diagram nodes can be locked by board editors so they won't be accidentally moved, resized, or selected. Diagram nodes that support text should support some rich text editing (i.e. bolding, underlining, italics). Font size should scale to try and fit as much text as possible down to a minimum. Text that still does not fit should be cut off with an ellipsis (...).

#### Diagram Connections

All nodes should support connections. Connections are most simply lines that extend from nodes to either another node or a point in space. They can be customized in color, shape (straight, angled, curved, etc.), pattern (solid, dotted, lined, etc.), ends (can be either a simple line or can have arrows at the ends), and can have text in or along them. Connections are created by using the anchors on a shape. The anchor should be in the midpoint of each of the four bounding boxes of the shape in addition to the four corners. Some shapes should have the line start from the closest point on the border of the shape (For example, two sides of a triangle do not touch the bounding box in the middle, but the connector line should still originate from the cloest point inward from that anchor point.) while other shapes will just have the line start from the anchor point regardless of the border (For example, a bracket with text on one side may have the arrow start on the other side of the bracket by the text which doesn't necessarily have a visible border to the user. Padding should be used appropriately in these cases.). 

#### Node Snapping

Nodes should support being snapped into place to make alignment easier. This alignment should coincide with the optionally visible grid lines and dots. Alignment should help with aligning objects to other objects in terms of their bounding box edges, or other object centers, and even spacing between other nodes. Fine adjustments can also be made with the user's arrow keys.

#### Sticky Notes

A user should be able to place sticky notes on the board. Sticky notes are essentially a diagram node, but they have a few other special features. Sticky notes can be placed individually from the diagram catalog by board editors, but a sticky note pad can also be placed by a board editor onto the board to be used even by board viewers (if the board is entered into the think mode with viewer access enabled). Sticky notes must be given a color from a given list (they cannot be transparent). Sticky notes can be configured to show the name(s) of the author(s). Sticky notes can be resized. 

#### Think Mode

A board can be entered into think mode, with an optional configurations. The idea of think mode is to force editors to use sticky notes. Different configurations of the think mode can be set: 
* Timer (When the timer expires, the board returns to normal behavior, allowing users to see each other's work and restricting board viewers if that permission was configured.)
* Viewer Participation
* Visiblity of what others are writing
* Groups to control which members can work together and view each others writing

#### Board Roles

|                                               | Owner | Admin | Editor | Viewer |
|-----------------------------------------------|-------|-------|--------|--------|
| Can delete the board                          | TRUE  |       |        |        |
| Can change board ownership                    | TRUE  |       |        |        |
| Can share the board with others (add members) | TRUE  | TRUE  |        |        |
| Can assign the admin role                     | TRUE  |       |        |        |
| Can assign non-admin roles                    | TRUE  | TRUE  |        |        |
| Can change the board mode                     | TRUE  | TRUE  |        |        |
| Can edit the board                            | TRUE  | TRUE  | TRUE   |        |
| Can view the board                            | TRUE  | TRUE  | TRUE   | TRUE   |

#### User Controls

Controls for navigating the board should be selectable by the user (but should default based on the user's type of device). Controls might be different for a user with a touch input, or a mouse, or a trackpad (i.e. clicking and dragging with the right click of a mouse to move around the board, or multi-finger gestures of a track pad to zoom in/out and move around.). There should also exist the ability to undo and redo actions (whether that be within the text editor on a diagram node to undo text or on the board itself with the movement, resizing, and management of diagram nodes).

#### Grouping

Users can select multiple nodes and connections and group them together. Grouped elements can be moved, resized, copied, and managed as a single cohesive unit.

#### Copying and Pasting

The application will support copying and pasting elements not only within the same board, but also across different boards.

#### Versioning and Revision History

In addition to standard undo/redo for the current session, the application will maintain a persistent revision history. This allows board owners to view past states and restore the board to previous versions.

#### Frames and Pages

Users can organize their infinite canvas using Frames or Pages. This allows users to partition large boards into logical sections, which can be easily navigated to or used to define specific areas for exporting and presentation.

#### Board Backgrounds

A board can be given a background type of:
* Grid Lines
* Grid Dots
* None

Lines and dots should adapt to the zoom level as to not make the pattern to cumbersome as the user zooms out. 

The background type can be assigned a color from a list and an opacity.

The board background color should match that of the app theme (light or dark). 

#### Exporting

A board should support being exported in a number of chosen formats:
* PDF
* SVG
* PNG
* JPEG

By default, the export will capture the entire board. Alternatively, users can export specific Frames/Pages. The background of the exported image can be set to either transparent or match the current theme background.