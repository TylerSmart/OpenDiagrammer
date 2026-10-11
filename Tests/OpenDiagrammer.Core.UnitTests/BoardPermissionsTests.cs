using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenDiagrammer.Core.Boards;

namespace OpenDiagrammer.Core.UnitTests;

[TestClass]
public sealed class BoardPermissionsTests
{
    [TestMethod]
    public void Owner_HasFullPermissions()
    {
        Assert.IsTrue(BoardRole.Owner.CanDeleteBoard());
        Assert.IsTrue(BoardRole.Owner.CanTransferOwnership());
        Assert.IsTrue(BoardRole.Owner.CanShareBoard());
        Assert.IsTrue(BoardRole.Owner.CanAssignRole(BoardRole.Admin));
        Assert.IsTrue(BoardRole.Owner.CanAssignRole(BoardRole.Editor));
        Assert.IsTrue(BoardRole.Owner.CanAssignRole(BoardRole.Viewer));
        Assert.IsTrue(BoardRole.Owner.CanChangeBoardMode());
        Assert.IsTrue(BoardRole.Owner.CanEditBoard());
        Assert.IsTrue(BoardRole.Owner.CanViewBoard());
        Assert.IsTrue(BoardRole.Owner.CanRemoveMember(BoardRole.Admin));
        Assert.IsTrue(BoardRole.Owner.CanRemoveMember(BoardRole.Editor));
        Assert.IsFalse(BoardRole.Owner.CanRemoveMember(BoardRole.Owner));
    }

    [TestMethod]
    public void Admin_HasRestrictedPermissions()
    {
        Assert.IsFalse(BoardRole.Admin.CanDeleteBoard());
        Assert.IsFalse(BoardRole.Admin.CanTransferOwnership());
        Assert.IsTrue(BoardRole.Admin.CanShareBoard());
        Assert.IsFalse(BoardRole.Admin.CanAssignRole(BoardRole.Admin));
        Assert.IsTrue(BoardRole.Admin.CanAssignRole(BoardRole.Editor));
        Assert.IsTrue(BoardRole.Admin.CanAssignRole(BoardRole.Viewer));
        Assert.IsTrue(BoardRole.Admin.CanChangeBoardMode());
        Assert.IsTrue(BoardRole.Admin.CanEditBoard());
        Assert.IsTrue(BoardRole.Admin.CanViewBoard());
        Assert.IsFalse(BoardRole.Admin.CanRemoveMember(BoardRole.Owner));
        Assert.IsFalse(BoardRole.Admin.CanRemoveMember(BoardRole.Admin));
        Assert.IsTrue(BoardRole.Admin.CanRemoveMember(BoardRole.Editor));
        Assert.IsTrue(BoardRole.Admin.CanRemoveMember(BoardRole.Viewer));
    }

    [TestMethod]
    public void Editor_CanEditAndViewOnly()
    {
        Assert.IsFalse(BoardRole.Editor.CanDeleteBoard());
        Assert.IsFalse(BoardRole.Editor.CanTransferOwnership());
        Assert.IsFalse(BoardRole.Editor.CanShareBoard());
        Assert.IsFalse(BoardRole.Editor.CanAssignRole(BoardRole.Editor));
        Assert.IsFalse(BoardRole.Editor.CanChangeBoardMode());
        Assert.IsTrue(BoardRole.Editor.CanEditBoard());
        Assert.IsTrue(BoardRole.Editor.CanViewBoard());
        Assert.IsFalse(BoardRole.Editor.CanRemoveMember(BoardRole.Viewer));
    }

    [TestMethod]
    public void Viewer_CanViewOnly()
    {
        Assert.IsFalse(BoardRole.Viewer.CanDeleteBoard());
        Assert.IsFalse(BoardRole.Viewer.CanTransferOwnership());
        Assert.IsFalse(BoardRole.Viewer.CanShareBoard());
        Assert.IsFalse(BoardRole.Viewer.CanAssignRole(BoardRole.Viewer));
        Assert.IsFalse(BoardRole.Viewer.CanChangeBoardMode());
        Assert.IsFalse(BoardRole.Viewer.CanEditBoard());
        Assert.IsTrue(BoardRole.Viewer.CanViewBoard());
        Assert.IsFalse(BoardRole.Viewer.CanRemoveMember(BoardRole.Viewer));
    }
}
