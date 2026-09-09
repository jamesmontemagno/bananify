using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Drawing;
using Microsoft.Internal.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Imaging.Interop;
using Microsoft.VisualStudio.ProjectSystem;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace Bananify.ProjectTree;

internal sealed class BananaImageCache : IDisposable
{
    private readonly ConcurrentDictionary<ProjectImageMoniker, ProjectImageMoniker> _composites = new();
    private readonly ConcurrentDictionary<ProjectImageMoniker, ProjectImageMoniker> _originals = new();
    private readonly List<IImageHandle> _handles = new();
    private IVsImageService2? _service;
    private IImageHandle? _banana;
    private Bitmap? _bitmap;

    public ProjectImageMoniker? GetOriginal(ProjectImageMoniker? image) =>
        image != null && _originals.TryGetValue(image, out var original) ? original : image;

    public bool TryGet(ProjectImageMoniker original, out ProjectImageMoniker composite) =>
        _composites.TryGetValue(original, out composite);

    public void Add(ProjectImageMoniker original)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (_composites.ContainsKey(original)) return;

        _service ??= Package.GetGlobalService(typeof(SVsImageService)) as IVsImageService2
            ?? throw new InvalidOperationException("Visual Studio's image service is unavailable.");

        if (_banana == null)
        {
            using var stream = typeof(BananaImageCache).Assembly.GetManifestResourceStream("Bananify.ProjectTree.Banana.png")
                ?? throw new InvalidOperationException("The embedded banana badge is missing.");
            using var source = new Bitmap(stream);
            _bitmap = new Bitmap(source);
            // This public SDK wrapper implements IVsUIObject's WinForms bitmap contract.
            _banana = _service.AddCustomImage(new WinFormsBitmapUIObject(_bitmap));
            if (_banana == null) throw new InvalidOperationException("The image service rejected the banana image.");
            _handles.Add(_banana);
        }

        var layers = new[]
        {
            new ImageCompositionLayer
            {
                ImageMoniker = new ImageMoniker { Guid = original.Guid, Id = original.Id },
                VirtualWidth = 16, VirtualHeight = 16,
                HorizontalAlignment = (uint)_UIImageHorizontalAlignment.IHA_Left,
                VerticalAlignment = (uint)_UIImageVerticalAlignment.IVA_Top,
            },
            new ImageCompositionLayer
            {
                ImageMoniker = _banana.Moniker,
                VirtualWidth = 8, VirtualHeight = 8,
                HorizontalAlignment = (uint)_UIImageHorizontalAlignment.IHA_Right,
                VerticalAlignment = (uint)_UIImageVerticalAlignment.IVA_Top,
            },
        };
        var handle = _service.AddCustomCompositeImage(16, 16, layers.Length, layers)
            ?? throw new InvalidOperationException("The image service rejected the composite banana badge.");
        _handles.Add(handle);
        var moniker = handle.Moniker;
        var composite = new ProjectImageMoniker(moniker.Guid, moniker.Id);
        _originals[composite] = original;
        _composites[original] = composite;
    }

    public void Dispose()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        // Retain image handles until project unload: old immutable CPS snapshots can still reference them.
        for (var i = _handles.Count - 1; i >= 0; i--)
        {
            try
            {
                _service!.RemoveCustomImage(_handles[i]);
            }
            catch (System.Runtime.InteropServices.COMException ex)
            {
                ActivityLog.LogError("Bananify", "Could not release a Solution Explorer badge image: " + ex);
            }
        }
        _handles.Clear();
        _composites.Clear();
        _originals.Clear();
        _banana = null;
        _bitmap?.Dispose();
        _bitmap = null;
        _service = null;
    }
}
