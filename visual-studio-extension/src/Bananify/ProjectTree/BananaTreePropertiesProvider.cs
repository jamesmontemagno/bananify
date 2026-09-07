using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.ProjectSystem;
using Microsoft.VisualStudio.Shell;

namespace Bananify.ProjectTree;

[Export(typeof(IProjectTreePropertiesProvider))]
// dotnet/project-system's ProjectTypeCapabilities uses ".NET", "CSharp" and "VB" (not "VisualBasic").
// The evaluated UsingMicrosoftNETSdk check below additionally excludes non-SDK CPS projects.
[AppliesTo(ProjectCapabilities.Cps + " & .NET & (" + ProjectCapabilities.CSharp + " | " + ProjectCapabilities.VB + ")")]
[Order(10000)]
internal sealed class BananaTreePropertiesProvider : IProjectTreePropertiesProvider, IDisposable
{
    private readonly UnconfiguredProject _project;
    private readonly IProjectThreadingService _threading;
    private readonly IProjectAsynchronousTasksService _tasks;
    private readonly Lazy<IProjectTreeProvider> _treeProvider;
    private readonly Lazy<IProjectTreeService> _treeService;
    private readonly BananaImageCache _images = new();
    private readonly ConcurrentDictionary<ProjectImageMoniker, byte> _pendingImages = new();
    private BadgeSnapshot _snapshot = BadgeSnapshot.Empty;
    private bool _initialized;
    private bool _subscribed;
    private volatile bool _sdkStyle;
    private int _disposed;
    private int _dirty;
    private int _running;
    private int _missingPath;
    private int _missingPathLogged;

    [ImportingConstructor]
    public BananaTreePropertiesProvider(
        UnconfiguredProject project,
        IProjectThreadingService threading,
        IProjectAsynchronousTasksService tasks,
        [Import(ExportContractNames.ProjectTreeProviders.PhysicalViewTree)] Lazy<IProjectTreeProvider> treeProvider,
        [Import(ExportContractNames.ProjectTreeProviders.PhysicalProjectTreeService)] Lazy<IProjectTreeService> treeService)
    {
        _project = project;
        _threading = threading;
        _tasks = tasks;
        _treeProvider = treeProvider;
        _treeService = treeService;
        _project.ProjectUnloading += OnProjectUnloadingAsync;
        QueueRefresh();
    }

    public void CalculatePropertyValues(
        IProjectTreeCustomizablePropertyContext propertyContext,
        IProjectTreeCustomizablePropertyValues propertyValues)
    {
        // CPS may pass an existing image during refresh; never badge our own badge.
        var original = _images.GetOriginal(propertyValues.Icon);
        var expanded = _images.GetOriginal(propertyValues.ExpandedIcon);
        if (propertyValues.Icon != original) propertyValues.Icon = original!;
        if (propertyValues.ExpandedIcon != expanded) propertyValues.ExpandedIcon = expanded!;

        var snapshot = Volatile.Read(ref _snapshot);
        if (Volatile.Read(ref _disposed) != 0 || !_sdkStyle || !snapshot.Enabled ||
            propertyContext.IsFolder || propertyContext.IsNonFileSystemProjectItem ||
            !propertyContext.ExistsOnDisk || string.IsNullOrEmpty(propertyContext.ItemType) ||
            propertyValues.Flags.Contains(ProjectTreeFlags.Common.ProjectRoot))
            return;

        // ItemName is only a caption. Never match it: duplicate names and linked items need physical paths.
        if (propertyContext.Metadata == null ||
            !propertyContext.Metadata.TryGetValue("FullPath", out var path) || !Path.IsPathRooted(path))
        {
            if (Interlocked.Exchange(ref _missingPath, 1) == 0) QueueRefresh();
            return;
        }
        if (!snapshot.VisibleDocuments.Contains(path)) return;

        propertyValues.Icon = Decorate(original)!;
        propertyValues.ExpandedIcon = Decorate(expanded)!;
    }

    private ProjectImageMoniker? Decorate(ProjectImageMoniker? original)
    {
        if (original == null || original.Guid == Guid.Empty) return original;
        if (_images.TryGet(original, out var composite)) return composite;
        if (_pendingImages.TryAdd(original, 0)) QueueRefresh();
        return original;
    }

    private void OnSessionChanged(object? sender, EventArgs args)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if ((!_initialized || _sdkStyle) && CaptureSnapshot()) QueueRefresh();
    }

    private bool CaptureSnapshot()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        var session = PartySession.Instance;
        var enabled = session.State.IsDecorating && session.State.FileBadgesEnabled;
        var previous = Volatile.Read(ref _snapshot);
        if (previous.Enabled == enabled &&
            (!enabled || previous.VisibleDocuments.SetEquals(session.VisibleDocuments)))
            return false;
        Volatile.Write(ref _snapshot, enabled
            ? new BadgeSnapshot(new HashSet<string>(session.VisibleDocuments, StringComparer.OrdinalIgnoreCase))
            : BadgeSnapshot.Empty);
        return true;
    }

    private void QueueRefresh()
    {
        if (Volatile.Read(ref _disposed) != 0 || _tasks.UnloadCancellationToken.IsCancellationRequested) return;
        Interlocked.Exchange(ref _dirty, 1);
        if (Interlocked.CompareExchange(ref _running, 1, 0) != 0) return;
        var task = _threading.JoinableTaskFactory.RunAsync(RefreshAsync);
        _tasks.RegisterAsyncTask(task, registerFaultHandler: true);
    }

    private async Task RefreshAsync()
    {
        var cancellationToken = _tasks.UnloadCancellationToken;
        try
        {
            // Avoid realizing a lazy physical-tree import inside the provider's MEF constructor.
            await Task.Yield();
            await _threading.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
            if (Volatile.Read(ref _disposed) != 0) return;
            if (!_initialized)
            {
                if (!_subscribed)
                {
                    PartySession.Instance.Changed += OnSessionChanged;
                    _subscribed = true;
                }
                var configured = await _project.GetSuggestedConfiguredProjectAsync();
                var properties = configured?.Services.ProjectPropertiesProvider
                    ?? throw new NotSupportedException("CPS did not expose the evaluated properties required to verify SDK-style projects.");
                var sdk = await properties
                    .GetCommonProperties().GetEvaluatedPropertyValueAsync("UsingMicrosoftNETSdk");
                await _threading.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
                if (Volatile.Read(ref _disposed) != 0) return;
                _sdkStyle = string.Equals(sdk, "true", StringComparison.OrdinalIgnoreCase);
                _initialized = true;
                CaptureSnapshot();
                if (!Volatile.Read(ref _snapshot).Enabled)
                {
                    Interlocked.Exchange(ref _dirty, 0);
                    return;
                }
            }

            if (!_sdkStyle)
            {
                Interlocked.Exchange(ref _dirty, 0);
                return;
            }
            if (!(_treeProvider.Value is IRefreshableProjectTreeProvider refreshable))
                throw new NotSupportedException("This CPS physical tree does not expose the public refresh contract.");

            while (Volatile.Read(ref _disposed) == 0 && Interlocked.Exchange(ref _dirty, 0) != 0)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (Volatile.Read(ref _missingPath) != 0 && Interlocked.Exchange(ref _missingPathLogged, 1) == 0)
                    ActivityLog.LogWarning("Bananify",
                        "CPS did not provide absolute FullPath metadata for a file in " + _project.FullPath +
                        ". That node is not badged; caption matching would decorate the wrong file. " +
                        "This project requires Windows runtime compatibility verification.");

                foreach (var original in _pendingImages.Keys)
                {
                    if (_pendingImages.TryRemove(original, out _) && Volatile.Read(ref _snapshot).Enabled)
                        _images.Add(original);
                }

                await refreshable.RefreshAsync(cancellationToken);
                await _treeService.Value.PublishLatestTreeAsync(false, false, cancellationToken);
                await _threading.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Project unload cancels refreshes before disposing this MEF scope.
        }
        catch (ActiveProjectConfigurationChangedException)
        {
            Interlocked.Exchange(ref _dirty, 1);
        }
        catch (Exception ex) when (ex is COMException or InvalidOperationException or NotSupportedException or IOException)
        {
            // Async extension boundary: report failures, leave base icons, and retry on the next session change.
            await _threading.JoinableTaskFactory.SwitchToMainThreadAsync();
            Volatile.Write(ref _snapshot, BadgeSnapshot.Empty);
            Interlocked.Exchange(ref _dirty, 0);
            ActivityLog.LogError("Bananify", "Solution Explorer badges failed for " + _project.FullPath + ": " + ex);
            await TryRestoreAsync(cancellationToken);
        }
        finally
        {
            Interlocked.Exchange(ref _running, 0);
            if (Volatile.Read(ref _dirty) != 0) QueueRefresh();
        }
    }

    private async Task TryRestoreAsync(CancellationToken cancellationToken)
    {
        if (Volatile.Read(ref _disposed) != 0 || cancellationToken.IsCancellationRequested) return;
        try
        {
            if (_treeProvider.Value is IRefreshableProjectTreeProvider refreshable)
            {
                await refreshable.RefreshAsync(cancellationToken);
                await _treeService.Value.PublishLatestTreeAsync(false, false, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception ex) when (ex is COMException or InvalidOperationException or NotSupportedException or IOException or ActiveProjectConfigurationChangedException)
        {
            await _threading.JoinableTaskFactory.SwitchToMainThreadAsync();
            ActivityLog.LogError("Bananify", "Badge recovery also failed; reload the affected project to restore its icons: " + ex);
        }
    }

    private async Task OnProjectUnloadingAsync(object? sender, EventArgs args)
    {
        await _threading.JoinableTaskFactory.SwitchToMainThreadAsync();
        DisposeOnUIThread();
    }

    public void Dispose()
    {
        if (Volatile.Read(ref _disposed) != 0) return;
        _threading.JoinableTaskFactory.Run(async () =>
        {
            await _threading.JoinableTaskFactory.SwitchToMainThreadAsync();
            DisposeOnUIThread();
        });
    }

    private void DisposeOnUIThread()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        _project.ProjectUnloading -= OnProjectUnloadingAsync;
        if (_subscribed) PartySession.Instance.Changed -= OnSessionChanged;
        _subscribed = false;
        Volatile.Write(ref _snapshot, BadgeSnapshot.Empty);
        _pendingImages.Clear();
        _images.Dispose();
    }

    private sealed class BadgeSnapshot
    {
        public static readonly BadgeSnapshot Empty = new(new HashSet<string>(StringComparer.OrdinalIgnoreCase), false);
        public BadgeSnapshot(HashSet<string> visibleDocuments, bool enabled = true)
        {
            VisibleDocuments = visibleDocuments;
            Enabled = enabled;
        }
        public HashSet<string> VisibleDocuments { get; }
        public bool Enabled { get; }
    }
}
