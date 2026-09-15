using System;

namespace Bananify.Core;

public sealed class CelebrationGate
{
    private readonly TimeSpan _cooldown;
    private TimeSpan? _last;

    public CelebrationGate(TimeSpan? cooldown = null)
    {
        _cooldown = cooldown ?? TimeSpan.FromSeconds(5);
        if (_cooldown < TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(cooldown));
    }

    public bool TryCelebrate(bool enabled, bool succeeded, bool cancelled, TimeSpan elapsed)
    {
        if (!enabled || !succeeded || cancelled) return false;
        if (_last.HasValue && elapsed - _last.Value < _cooldown) return false;
        _last = elapsed;
        return true;
    }

    public void Reset() => _last = null;
}
