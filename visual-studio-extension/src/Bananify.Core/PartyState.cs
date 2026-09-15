using System;

namespace Bananify.Core;

/// <summary>An immutable snapshot shared by native views and project-tree providers.</summary>
public sealed class PartyState
{
    public PartyState(bool active = false, bool paused = false, int density = 5,
        string monkey = "brown", bool reducedMotion = false, bool fileBadgesEnabled = false)
    {
        if (density < 1 || density > 5)
            throw new ArgumentOutOfRangeException(nameof(density));
        if (!IsKnownMonkey(monkey))
            throw new ArgumentException("Choose brown, black-and-white, or golden.", nameof(monkey));
        Active = active;
        Paused = active && paused;
        Density = density;
        Monkey = monkey;
        ReducedMotion = reducedMotion;
        FileBadgesEnabled = fileBadgesEnabled;
    }

    public bool Active { get; }
    public bool Paused { get; }
    public int Density { get; }
    public string Monkey { get; }
    public bool ReducedMotion { get; }
    public bool FileBadgesEnabled { get; }
    public bool IsDecorating => Active && !Paused;
    public bool ShouldAnimate(bool visible) => IsDecorating && visible && !ReducedMotion;
    public string MonkeyName => Monkey == "golden" ? "Henry" : Monkey == "black-and-white" ? "Sebastian" : "Mooch";

    public static bool IsKnownMonkey(string value) =>
        value == "brown" || value == "black-and-white" || value == "golden";

    public PartyState Start() => With(active: true, paused: false);
    public PartyState PauseOrResume() => Active ? With(paused: !Paused) : Start();
    public PartyState Restore() => With(active: false, paused: false);
    public PartyState More() => With(active: true, paused: false, density: Density == 5 ? 1 : Density + 1);

    public PartyState With(bool? active = null, bool? paused = null, int? density = null,
        string? monkey = null, bool? reducedMotion = null, bool? fileBadgesEnabled = null) =>
        new PartyState(active ?? Active, paused ?? Paused, density ?? Density, monkey ?? Monkey,
            reducedMotion ?? ReducedMotion, fileBadgesEnabled ?? FileBadgesEnabled);
}
