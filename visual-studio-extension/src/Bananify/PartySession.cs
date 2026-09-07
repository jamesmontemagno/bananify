using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Windows;
using Bananify.Core;
using Bananify.Options;
using Microsoft.VisualStudio.Shell;

namespace Bananify;

public sealed class PartySession
{
    private BananifyOptions? _options;
    private bool _requestedReducedMotion;
    private bool _celebrateOnSave;
    private bool _celebrateOnBuild;
    private readonly CelebrationGate _celebrationGate = new CelebrationGate();
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private IReadOnlyCollection<string> _visibleDocuments = Array.Empty<string>();

    private PartySession() { }
    public static PartySession Instance { get; } = new PartySession();
    public PartyState State { get; private set; } = new PartyState();
    public IReadOnlyCollection<string> VisibleDocuments => _visibleDocuments;
    public event EventHandler? Changed;
    public event EventHandler? Celebrated;

    public void ApplyOptions(BananifyOptions options)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (options == null) throw new ArgumentNullException(nameof(options));
        var next = new PartyState(options.Enabled, State.Paused, options.Density, options.Monkey,
            options.ReducedMotion || !SystemParameters.ClientAreaAnimation || SystemParameters.HighContrast,
            options.FileBadgesEnabled);
        _options = options;
        _requestedReducedMotion = options.ReducedMotion;
        _celebrateOnSave = options.CelebrateOnSave;
        _celebrateOnBuild = options.CelebrateOnBuild;
        State = next;
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void RefreshSystemPreferences()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        State = State.With(reducedMotion: _requestedReducedMotion ||
            !SystemParameters.ClientAreaAnimation || SystemParameters.HighContrast);
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void Start()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Change(State.Start());
    }
    public void PauseOrResume()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Change(State.PauseOrResume());
    }
    public void Restore()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Change(State.Restore());
        _celebrationGate.Reset();
    }

    public void More()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Change(State.More());
        Celebrated?.Invoke(this, EventArgs.Empty);
    }

    public void SelectMonkey(string monkey)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Change(State.With(monkey: monkey));
    }

    public void SetVisibleDocuments(IEnumerable<string> documents)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        var next = DecorationRules.NormalizeVisibleDocuments(documents);
        if (next.SetEquals(_visibleDocuments)) return;
        _visibleDocuments = Array.AsReadOnly(next.ToArray());
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void CelebrateSave()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Celebrate(_celebrateOnSave, true, false);
    }
    public void CelebrateBuild(bool succeeded, bool cancelled)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Celebrate(_celebrateOnBuild, succeeded, cancelled);
    }

    private void Celebrate(bool enabled, bool succeeded, bool cancelled)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (_celebrationGate.TryCelebrate(enabled && State.IsDecorating, succeeded, cancelled, _clock.Elapsed))
            Celebrated?.Invoke(this, EventArgs.Empty);
    }

    private void Change(PartyState next)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        State = next;
        try
        {
            if (_options != null)
            {
                _options.Enabled = State.Active;
                _options.Density = State.Density;
                _options.Monkey = State.Monkey;
                _options.SaveSettingsToStorage();
            }
        }
        finally
        {
            // A settings-store failure must not leave old decorations running after Restore.
            Changed?.Invoke(this, EventArgs.Empty);
        }
    }

    public void Shutdown()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        State = State.Restore();
        _visibleDocuments = Array.Empty<string>();
        Changed?.Invoke(this, EventArgs.Empty);
        _options = null;
    }
}
