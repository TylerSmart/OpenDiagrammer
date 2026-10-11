namespace OpenDiagrammer.Core.Boards;

public enum BoardRole
{
    Owner = 0,
    Admin = 1,
    Editor = 2,
    Viewer = 3,
}

public enum BoardBackgroundType
{
    GridLines = 0,
    GridDots = 1,
    None = 2,
}

public enum BoardMode
{
    Normal = 0,
    ThinkMode = 1,
}
