using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenDiagrammer.Core.Boards;
using YDotNet.Document;
using YDotNet.Document.Cells;

namespace OpenDiagrammer.Core.UnitTests;

[TestClass]
public class CrdtMergeServiceTests
{
    private readonly ICrdtMergeService _mergeService = new YDotNetCrdtMergeService();

    [TestMethod]
    public void MergeUpdate_WithEmptyBaseState_ReturnsUpdate()
    {
        using var doc = new Doc();
        var map = doc.Map("shapes");
        using var tx = doc.WriteTransaction();
        map.Insert(tx!, "n-1", Input.String("node-1"));
        var update = tx!.StateDiffV1([0]);

        var result = _mergeService.MergeUpdate(null, update!);

        Assert.IsNotNull(result);
        Assert.IsNotEmpty(result);
    }

    [TestMethod]
    public void MergeUpdate_WithBaseAndNewUpdate_CombinesBothUpdates()
    {
        // 1. Doc A creates shape 1
        using var docA = new Doc();
        var mapA = docA.Map("shapes");
        using (var txA = docA.WriteTransaction())
        {
            mapA.Insert(txA!, "shape-1", Input.String("circle"));
            var updateA = txA!.StateDiffV1([0])!;

            // 2. Doc B creates shape 2
            using var docB = new Doc();
            var mapB = docB.Map("shapes");
            using (var txB = docB.WriteTransaction())
            {
                mapB.Insert(txB!, "shape-2", Input.String("rectangle"));
                var updateB = txB!.StateDiffV1([0])!;

                // 3. Merge both via CrdtMergeService
                var merged = _mergeService.MergeUpdate(updateA, updateB);

                // 4. Verify in a new Doc that both shapes exist
                using var docCombined = new Doc();
                var mapCombined = docCombined.Map("shapes");
                using (var txCombined = docCombined.WriteTransaction())
                {
                    txCombined!.ApplyV1(merged);
                    var s1 = mapCombined.Get(txCombined, "shape-1");
                    var s2 = mapCombined.Get(txCombined, "shape-2");

                    Assert.IsNotNull(s1);
                    Assert.AreEqual("circle", s1.String);
                    Assert.IsNotNull(s2);
                    Assert.AreEqual("rectangle", s2.String);
                }
            }
        }
    }
}
