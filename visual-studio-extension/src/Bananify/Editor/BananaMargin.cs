using System;
using System.ComponentModel.Composition;
using System.Windows;
using System.Windows.Controls;
using Bananify.Core;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;

namespace Bananify.Editor;

[Export(typeof(IWpfTextViewMarginProvider))]
[Name(BananaMargin.Name)]
[MarginContainer(PredefinedMarginNames.Left)]
[Order(After = PredefinedMarginNames.LineNumber)]
[ContentType("code")]
[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
[TextViewRole(PredefinedTextViewRoles.Editable)]
internal sealed class BananaMarginProvider : IWpfTextViewMarginProvider
{
    [Import]
    public ITextDocumentFactoryService Documents { get; set; } = null!;

    public IWpfTextViewMargin CreateMargin(IWpfTextViewHost host, IWpfTextViewMargin container) =>
        new BananaMargin(host.TextView, Documents);
}

internal sealed class BananaMargin : IWpfTextViewMargin
{
    public const string Name = "Bananify.Margin";
    private readonly IWpfTextView _view;
    private readonly ITextDocumentFactoryService _documents;
    private readonly Canvas _canvas = new Canvas { Width = 20, ClipToBounds = true, Focusable = false };
    private bool _disposed;

    public BananaMargin(IWpfTextView view, ITextDocumentFactoryService documents)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _view = view;
        _documents = documents;
        _view.LayoutChanged += OnLayout;
        _view.Closed += OnClosed;
        _view.VisualElement.IsVisibleChanged += OnVisible;
        PartySession.Instance.Changed += OnChanged;
        Render();
    }

    public FrameworkElement VisualElement => _canvas;
    public double MarginSize => Enabled ? 20 : 0;
    public bool Enabled => !_disposed && PartySession.Instance.State.IsDecorating;
    public ITextViewMargin? GetTextViewMargin(string marginName) => marginName == Name ? this : null;

    private void OnLayout(object? sender, TextViewLayoutChangedEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Render();
    }
    private void OnChanged(object? sender, EventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Render();
    }
    private void OnVisible(object sender, DependencyPropertyChangedEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Render();
    }

    private void Render()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _canvas.Children.Clear();
        _canvas.Visibility = Enabled ? Visibility.Visible : Visibility.Collapsed;
        if (!Enabled || _view.IsClosed || !_view.VisualElement.IsVisible || _view.InLayout || _view.TextViewLines == null) return;
        var state = PartySession.Instance.State;
        string identity = _documents.TryGetTextDocument(_view.TextDataModel.DocumentBuffer, out var document)
            ? document.FilePath : "untitled";
        int count = 0;
        foreach (var line in _view.TextViewLines)
        {
            if (count >= Math.Min(6, state.Density + 1)) break;
            var logical = line.Start.GetContainingLine();
            if (!line.IsFirstTextViewLineForSnapshotLine || logical.Length > 8192 || string.IsNullOrWhiteSpace(logical.GetText()) ||
                DecorationRules.Hash("gutter:" + identity + ":" + logical.LineNumber) % 100 >= 7) continue;
            var image = new DecorativeImage
            {
                Source = count % 2 == 0 ? BananaArtwork.Monkey(state.Monkey) : BananaArtwork.Banana,
                Width = 16,
                Height = Math.Min(18, line.TextHeight),
                ToolTip = state.MonkeyName + " says: One small commit is still a big step forward.",
                Focusable = false
            };
            Canvas.SetLeft(image, 2);
            Canvas.SetTop(image, line.TextTop - _view.ViewportTop);
            _canvas.Children.Add(image);
            count++;
        }
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
        _view.LayoutChanged -= OnLayout;
        _view.Closed -= OnClosed;
        _view.VisualElement.IsVisibleChanged -= OnVisible;
        PartySession.Instance.Changed -= OnChanged;
        _canvas.Children.Clear();
    }
}
