using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using Bananify.Core;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;

namespace Bananify.Editor;

internal sealed class BananaView : IDisposable
{
    private static readonly HashSet<BananaView> Views = new HashSet<BananaView>();
    private readonly IWpfTextView _view;
    private readonly IAdornmentLayer _layer;
    private readonly ITextDocumentFactoryService _documents;
    private readonly Dictionary<int, DecorativeImage> _visuals = new Dictionary<int, DecorativeImage>();
    private ITextDocument? _document;
    private DispatcherOperation? _pending;
    private bool _disposed;
    private const int MaxDecorations = 120;

    internal BananaView(IWpfTextView view, ITextDocumentFactoryService documents)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _view = view;
        _documents = documents;
        _layer = view.GetAdornmentLayer(BananaViewProvider.LayerName);
        Views.Add(this);
        _view.LayoutChanged += OnLayoutChanged;
        _view.Closed += OnClosed;
        _view.VisualElement.IsVisibleChanged += OnVisibilityChanged;
        PartySession.Instance.Changed += OnStateChanged;
        ResolveDocument();
        UpdateVisibleDocuments();
        QueueRender();
    }

    private void ResolveDocument()
    {
        if (_document != null || !_documents.TryGetTextDocument(_view.TextDataModel.DocumentBuffer, out var document)) return;
        _document = document;
        _document.FileActionOccurred += OnFileAction;
    }

    private void OnFileAction(object sender, TextDocumentFileActionEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        UpdateVisibleDocuments();
        QueueRender();
    }

    private static void UpdateVisibleDocuments()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        PartySession.Instance.SetVisibleDocuments(Views
            .Where(v => !v._disposed && !v._view.IsClosed && v._view.VisualElement.IsVisible && v._document != null)
            .Select(v => v._document!.FilePath));
    }

    private void OnStateChanged(object? sender, EventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (!PartySession.Instance.State.IsDecorating)
        {
            _layer.RemoveAllAdornments();
            _visuals.Clear();
        }
        QueueRender();
    }

    private void OnLayoutChanged(object? sender, TextViewLayoutChangedEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        ResolveDocument();
        UpdateVisibleDocuments();
        QueueRender();
    }

    private void OnVisibilityChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        UpdateVisibleDocuments();
        if (!_view.VisualElement.IsVisible)
        {
            _layer.RemoveAllAdornments();
            _visuals.Clear();
        }
        QueueRender();
    }

    [System.Diagnostics.CodeAnalysis.SuppressMessage("Usage", "VSTHRD001",
        Justification = "Already on the UI thread; coalesce editor layout callbacks into one background-priority render.")]
    private void QueueRender()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (_disposed || _view.IsClosed || !PartySession.Instance.State.IsDecorating ||
            !_view.VisualElement.IsVisible || _pending?.Status == DispatcherOperationStatus.Pending) return;
        _pending = _view.VisualElement.Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(Render));
    }

    private void Render()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _pending = null;
        if (_disposed || _view.IsClosed) return;
        _layer.RemoveAllAdornments();
        var state = PartySession.Instance.State;
        if (!state.IsDecorating || !_view.VisualElement.IsVisible || _view.InLayout || _view.TextViewLines == null) return;
        string identity = _document?.FilePath ?? "untitled";
        var retained = new HashSet<int>();
        int count = 0;
        foreach (var line in _view.TextViewLines)
        {
            if (count >= MaxDecorations) break;
            if (!line.IsLastTextViewLineForSnapshotLine) continue;
            var logicalLine = line.Start.GetContainingLine();
            if (logicalLine.Length > 8192 || string.IsNullOrWhiteSpace(logicalLine.GetText()) ||
                !DecorationRules.ShouldDecorate(identity, logicalLine.LineNumber, state.Density)) continue;
            double size = Math.Min(20, Math.Max(12, line.TextHeight));
            double left = line.TextRight + 8;
            if (left < _view.ViewportLeft || left + size * 2 > _view.ViewportRight) continue;
            if (!_visuals.TryGetValue(logicalLine.LineNumber, out var art))
            {
                art = new DecorativeImage { IsHitTestVisible = false, Focusable = false };
                _visuals.Add(logicalLine.LineNumber, art);
            }
            art.Source = DecorationRules.Variant(identity, logicalLine.LineNumber, 4) == 2
                ? BananaArtwork.Monkey(state.Monkey) : BananaArtwork.Banana;
            art.Width = size;
            art.Height = size;
            art.Opacity = SystemParameters.HighContrast ? 1 : 0.8;
            Canvas.SetLeft(art, left);
            Canvas.SetTop(art, line.TextTop);
            _layer.AddAdornment(AdornmentPositioningBehavior.TextRelative, line.Extent, this, art, null);
            retained.Add(logicalLine.LineNumber);
            count++;
        }
        foreach (int number in _visuals.Keys.Where(number => !retained.Contains(number)).ToArray())
            _visuals.Remove(number);
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Dispose();
    }

    public void Dispose()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (_disposed) return;
        _disposed = true;
        _pending?.Abort();
        _view.LayoutChanged -= OnLayoutChanged;
        _view.Closed -= OnClosed;
        _view.VisualElement.IsVisibleChanged -= OnVisibilityChanged;
        PartySession.Instance.Changed -= OnStateChanged;
        if (_document != null) _document.FileActionOccurred -= OnFileAction;
        _layer.RemoveAllAdornments();
        _visuals.Clear();
        Views.Remove(this);
        UpdateVisibleDocuments();
    }
}
