using System;
using System.Linq;
using Bananify.Core;
using Xunit;

namespace Bananify.Tests;

public sealed class PartyTests
{
    [Fact]
    public void DefaultsAreOptInAndSnapshotsAreIndependent()
    {
        var original = new PartyState();
        var active = original.With(active: true);
        Assert.False(original.IsDecorating);
        Assert.False(original.FileBadgesEnabled);
        Assert.Equal(5, original.Density);
        Assert.True(active.IsDecorating);
        Assert.True(active.ShouldAnimate(true));
        Assert.False(active.ShouldAnimate(false));
        Assert.False(active.With(reducedMotion: true).ShouldAnimate(true));
        Assert.False(active.With(paused: true).IsDecorating);
        Assert.False(active.With(active: false, paused: true).Paused);
    }

    [Theory]
    [InlineData("brown", "Mooch")]
    [InlineData("black-and-white", "Sebastian")]
    [InlineData("golden", "Henry")]
    public void CompanionsRetainTheirNames(string id, string name) =>
        Assert.Equal(name, new PartyState(monkey: id).MonkeyName);

    [Fact]
    public void InvalidPreferencesAreRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new PartyState(density: 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => new PartyState(density: 6));
        Assert.Throws<ArgumentException>(() => new PartyState(monkey: "unknown"));
    }

    [Fact]
    public void PauseRestoreAndMoreHaveSharedNativeAndPanelSemantics()
    {
        var state = new PartyState(monkey: "golden", fileBadgesEnabled: true).PauseOrResume();
        Assert.True(state.IsDecorating);
        state = state.PauseOrResume();
        Assert.True(state.Paused);
        Assert.False(state.IsDecorating);
        state = state.More();
        Assert.True(state.IsDecorating);
        Assert.Equal(1, state.Density);
        state = state.Restore();
        Assert.False(state.Active);
        Assert.False(state.Paused);
        Assert.Equal("golden", state.Monkey);
        Assert.True(state.FileBadgesEnabled);
        Assert.Equal(1, state.Start().Density);
    }

    [Fact]
    public void DensityAddsStableDecorations()
    {
        int[] low = Enumerable.Range(0, 1000).Where(i => DecorationRules.ShouldDecorate("file:///test.cs", i, 1)).ToArray();
        int[] high = Enumerable.Range(0, 1000).Where(i => DecorationRules.ShouldDecorate("file:///test.cs", i, 5)).ToArray();
        Assert.True(high.Length > low.Length);
        Assert.All(low, i => Assert.Contains(i, high));
        Assert.Equal(high, Enumerable.Range(0, 1000).Where(i => DecorationRules.ShouldDecorate("file:///test.cs", i, 5)).ToArray());
        Assert.Equal(4, Enumerable.Range(0, 100).Select(i => DecorationRules.Variant("file", i, 4)).Distinct().Count());
    }

    [Theory]
    [InlineData("file:///src/main.cs", 4, false, 1)]
    [InlineData("file:///src/\U0001F34C.cs", 12, true, 1)]
    public void SelectionMatchesExistingJavaScriptCodePointHash(string document, int line, bool decorated, int variant)
    {
        Assert.Equal(decorated, DecorationRules.ShouldDecorate(document, line, 5));
        Assert.Equal(variant, DecorationRules.Variant(document, line, 4));
    }

    [Fact]
    public void VisibleDocumentMembershipIsCaseInsensitiveAndDeduplicated()
    {
        var files = DecorationRules.NormalizeVisibleDocuments(new[] { @"C:\code\A.cs", @"c:\code\a.cs", @"C:\code\B.cs" });
        Assert.Equal(2, files.Count);
        Assert.Contains(@"C:\CODE\A.CS", files);
        Assert.Throws<ArgumentException>(() => DecorationRules.NormalizeVisibleDocuments(new[] { "" }));
    }

    [Fact]
    public void SaveAndBuildShareCooldownAndFailuresDoNotConsumeIt()
    {
        var gate = new CelebrationGate();
        Assert.False(gate.TryCelebrate(false, true, false, TimeSpan.Zero));
        Assert.False(gate.TryCelebrate(true, false, false, TimeSpan.Zero));
        Assert.False(gate.TryCelebrate(true, true, true, TimeSpan.Zero));
        Assert.True(gate.TryCelebrate(true, true, false, TimeSpan.Zero));
        Assert.False(gate.TryCelebrate(true, true, false, TimeSpan.FromSeconds(4.999)));
        Assert.True(gate.TryCelebrate(true, true, false, TimeSpan.FromSeconds(5)));
        gate.Reset();
        Assert.True(gate.TryCelebrate(true, true, false, TimeSpan.FromSeconds(5)));
    }
}
