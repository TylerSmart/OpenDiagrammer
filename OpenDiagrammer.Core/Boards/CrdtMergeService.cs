using YDotNet.Document;

namespace OpenDiagrammer.Core.Boards;

public interface ICrdtMergeService
{
    byte[] MergeUpdate(byte[]? baseState, byte[] update);
}

public sealed class YDotNetCrdtMergeService : ICrdtMergeService
{
    public byte[] MergeUpdate(byte[]? baseState, byte[] update)
    {
        if (update is null || update.Length == 0)
        {
            return baseState ?? [];
        }

        using var doc = new Doc();
        using var tx = doc.WriteTransaction();
        if (tx is null)
        {
            return update;
        }

        if (baseState is not null && baseState.Length > 0)
        {
            tx.ApplyV1(baseState);
        }

        tx.ApplyV1(update);

        return tx.StateDiffV1([0]) ?? [];
    }
}
