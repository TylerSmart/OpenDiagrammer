namespace OpenDiagrammer.Core.Boards;

public static class BoardPermissions
{
    public static bool CanDeleteBoard(this BoardRole role) => role == BoardRole.Owner;

    public static bool CanTransferOwnership(this BoardRole role) => role == BoardRole.Owner;

    public static bool CanShareBoard(this BoardRole role) =>
        role is BoardRole.Owner or BoardRole.Admin;

    public static bool CanAssignRole(this BoardRole actorRole, BoardRole targetRole) =>
        actorRole switch
        {
            BoardRole.Owner => targetRole
                is BoardRole.Admin
                    or BoardRole.Editor
                    or BoardRole.Viewer,
            BoardRole.Admin => targetRole is BoardRole.Editor or BoardRole.Viewer,
            _ => false,
        };

    public static bool CanRemoveMember(this BoardRole actorRole, BoardRole targetMemberRole) =>
        actorRole switch
        {
            BoardRole.Owner => targetMemberRole != BoardRole.Owner,
            BoardRole.Admin => targetMemberRole is BoardRole.Editor or BoardRole.Viewer,
            _ => false,
        };

    public static bool CanChangeBoardMode(this BoardRole role) =>
        role is BoardRole.Owner or BoardRole.Admin;

    public static bool CanEditBoard(this BoardRole role) =>
        role is BoardRole.Owner or BoardRole.Admin or BoardRole.Editor;

    public static bool CanViewBoard(this BoardRole role) =>
        role is BoardRole.Owner or BoardRole.Admin or BoardRole.Editor or BoardRole.Viewer;
}
