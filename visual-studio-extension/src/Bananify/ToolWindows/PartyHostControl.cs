using System;
using System.ComponentModel;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Shell;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Bananify.ToolWindows;

public sealed class PartyHostControl : UserControl, IDisposable
{
    private const string Origin = "https://bananify.invalid";
    private const string Page = Origin + "/party.html";
    private readonly bool compact;
    private readonly Func<string> userDataRoot;
    private readonly Grid layout = new();
    private readonly StackPanel fallback = new() { Margin = new Thickness(16) };
    private readonly TextBlock status = new() { TextWrapping = TextWrapping.Wrap };
    private readonly Button retry = new() { Content = "_Retry party", Margin = new Thickness(0, 12, 0, 0) };
    private readonly Button restore = new() { Content = "_Restore decorations", Margin = new Thickness(0, 8, 0, 0) };
    private WebView2? browser;
    private bool disposed;
    private bool subscribed;
    private bool initializing;
    private bool ready;
    private bool loaded;

    public PartyHostControl(bool compact, Func<string> userDataRoot)
    {
        this.compact = compact;
        this.userDataRoot = userDataRoot ?? throw new ArgumentNullException(nameof(userDataRoot));
        SetResourceReference(BackgroundProperty, EnvironmentColors.ToolWindowBackgroundBrushKey);
        SetResourceReference(ForegroundProperty, EnvironmentColors.ToolWindowTextBrushKey);
        status.Text = "Preparing the bunch…";
        fallback.Children.Add(status);
        fallback.Children.Add(retry);
        fallback.Children.Add(restore);
        layout.Children.Add(fallback);
        Content = layout;
        retry.Click += Retry;
        restore.Click += Restore;
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        IsVisibleChanged += VisibilityChanged;
    }

    [SuppressMessage("Usage", "VSTHRD100", Justification = "WPF Loaded event; expected browser initialization failures are surfaced by InitializeAsync.")]
    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (disposed) return;
        loaded = true;
        Subscribe();
        await InitializeAsync();
        SendTheme();
        SendSnapshot();
    }

    private void Subscribe()
    {
        if (subscribed) return;
        subscribed = true;
        PartySession.Instance.Changed += StateChanged;
        PartySession.Instance.Celebrated += Celebrated;
        VSColorTheme.ThemeChanged += ThemeChanged;
        SystemParameters.StaticPropertyChanged += SystemSettingChanged;
    }

    private void Unsubscribe()
    {
        if (!subscribed) return;
        subscribed = false;
        PartySession.Instance.Changed -= StateChanged;
        PartySession.Instance.Celebrated -= Celebrated;
        VSColorTheme.ThemeChanged -= ThemeChanged;
        SystemParameters.StaticPropertyChanged -= SystemSettingChanged;
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        loaded = false;
        SendSnapshot();
        Unsubscribe();
    }

    [SuppressMessage("Usage", "VSTHRD100", Justification = "WPF Click event; expected browser initialization failures are surfaced by InitializeAsync.")]
    private async void Retry(object sender, RoutedEventArgs e) => await InitializeAsync();
    private void Restore(object sender, RoutedEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        try { PartySession.Instance.Restore(); }
        catch (COMException ex) { ShowError(ex); }
        catch (IOException ex) { ShowError(ex); }
        catch (UnauthorizedAccessException ex) { ShowError(ex); }
    }
    private void StateChanged(object? sender, EventArgs e) => SendSnapshot();
    private void VisibilityChanged(object sender, DependencyPropertyChangedEventArgs e) => SendSnapshot();
    [SuppressMessage("Usage", "VSTHRD100", Justification = "WPF system-preference event; marshal to the IDE thread before reading visual state.")]
    private async void SystemSettingChanged(object? sender, PropertyChangedEventArgs e)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        if (!disposed) SendSnapshot();
    }
    [SuppressMessage("Usage", "VSTHRD100", Justification = "VS theme event; marshal to the IDE thread before reading theme resources.")]
    private async void ThemeChanged(ThemeChangedEventArgs e)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        if (!disposed) SendTheme();
    }

    private async Task InitializeAsync()
    {
        if (disposed || initializing || ready) return;
        initializing = true;
        retry.IsEnabled = false;
        status.Text = "Preparing the bunch…";
        fallback.Visibility = Visibility.Visible;
        try
        {
            ReleaseBrowser();
            var webRoot = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)!, "Web");
            if (!File.Exists(Path.Combine(webRoot, "party.html")))
                throw new FileNotFoundException("Packaged party assets were not found.");
            var localRoot = userDataRoot();
            if (!Path.IsPathRooted(localRoot))
                throw new InvalidOperationException("Visual Studio did not provide an absolute local data directory.");
            var userData = Path.Combine(localRoot, "Bananify", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, userData);
            if (disposed) return;
            var view = new WebView2();
            browser = view;
            layout.Children.Insert(0, view);
            await view.EnsureCoreWebView2Async(environment);
            if (disposed || browser != view) return;
            var core = view.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.IsWebMessageEnabled = true;
            core.Settings.IsBuiltInErrorPageEnabled = false;
            core.SetVirtualHostNameToFolderMapping("bananify.invalid", webRoot, CoreWebView2HostResourceAccessKind.DenyCors);
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += ResourceRequested;
            core.NavigationStarting += NavigationStarting;
            core.FrameNavigationStarting += FrameNavigationStarting;
            core.NewWindowRequested += NewWindowRequested;
            core.PermissionRequested += PermissionRequested;
            core.DownloadStarting += DownloadStarting;
            core.WebMessageReceived += MessageReceived;
            core.NavigationCompleted += NavigationCompleted;
            core.ProcessFailed += ProcessFailed;
            core.Navigate(Page);
        }
        catch (WebView2RuntimeNotFoundException ex) { if (!disposed) ShowError(ex); }
        catch (COMException ex) { if (!disposed) ShowError(ex); }
        catch (IOException ex) { if (!disposed) ShowError(ex); }
        catch (UnauthorizedAccessException ex) { if (!disposed) ShowError(ex); }
        catch (InvalidOperationException ex) { if (!disposed) ShowError(ex); }
        finally
        {
            initializing = false;
            if (!disposed) retry.IsEnabled = true;
        }
    }

    private static bool IsTrustedPage(string source) => string.Equals(source, Page, StringComparison.Ordinal);
    private static bool IsPackagedResource(string source) =>
        source == Page || source == Origin + "/party.css" || source == Origin + "/party.js";

    private void ResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (!IsPackagedResource(e.Request.Uri) || e.Request.Method != "GET")
            e.Response = browser!.CoreWebView2.Environment.CreateWebResourceResponse(null, 403, "Blocked", "");
    }

    private void NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!IsTrustedPage(e.Uri) || e.IsRedirected) e.Cancel = true;
    }
    private void FrameNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e) => e.Cancel = true;
    private void NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e) => e.Handled = true;
    private void PermissionRequested(object? sender, CoreWebView2PermissionRequestedEventArgs e) => e.State = CoreWebView2PermissionState.Deny;
    private void DownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e) => e.Cancel = true;

    private void NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!e.IsSuccess) ShowError(new InvalidOperationException("The local party page could not be loaded."));
    }

    private void ProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e) =>
        ShowError(new InvalidOperationException("The party browser stopped. Retry to bring back the bunch."));

    private void MessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (disposed) return;
        if (!IsTrustedPage(e.Source) || !IsTrustedPage(browser?.CoreWebView2.Source ?? ""))
        {
            RejectMessage("Untrusted message origin.");
            return;
        }
        try
        {
            var json = e.WebMessageAsJson;
            if (json.Length > 256) { RejectMessage("Message exceeds the length limit."); return; }
            var payload = JObject.Parse(json, new JsonLoadSettings { DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error });
            if (payload["command"]?.Type != JTokenType.String) { RejectMessage("Missing string command."); return; }
            var command = (string)payload["command"]!;
            if (command == "monkey")
            {
                if (payload.Properties().Count() != 2 || payload["monkey"]?.Type != JTokenType.String)
                { RejectMessage("Invalid monkey message shape."); return; }
                var monkey = (string)payload["monkey"]!;
                if (monkey is "brown" or "black-and-white" or "golden") PartySession.Instance.SelectMonkey(monkey);
                else RejectMessage("Unknown monkey.");
                return;
            }
            if (payload.Properties().Count() != 1) { RejectMessage("Unexpected message fields."); return; }
            switch (command)
            {
                case "ready":
                    ready = true;
                    fallback.Visibility = Visibility.Collapsed;
                    SendTheme();
                    SendSnapshot();
                    break;
                case "start": PartySession.Instance.Start(); break;
                case "pause": PartySession.Instance.PauseOrResume(); break;
                case "restore": PartySession.Instance.Restore(); break;
                case "more": PartySession.Instance.More(); break;
                default: RejectMessage("Unknown command."); break;
            }
        }
        catch (JsonException) { RejectMessage("Invalid JSON message."); }
        catch (COMException ex) { ShowError(ex); }
        catch (IOException ex) { ShowError(ex); }
        catch (UnauthorizedAccessException ex) { ShowError(ex); }
    }

    private static void RejectMessage(string reason) =>
        ActivityLog.LogWarning("Bananify", "Rejected party message: " + reason);

    private void SendSnapshot()
    {
        if (disposed || !ready) return;
        var state = PartySession.Instance.State;
        Post(new
        {
            type = "snapshot",
            active = state.Active,
            paused = state.Paused,
            visible = loaded && IsVisible,
            reducedMotion = state.ReducedMotion || !SystemParameters.ClientAreaAnimation || SystemParameters.HighContrast,
            density = state.Density,
            monkey = state.Monkey,
            compact
        });
    }

    private void SendTheme()
    {
        if (disposed || !ready) return;
        string Color(ThemeResourceKey key)
        {
            var color = VSColorTheme.GetThemedColor(key);
            return $"#{color.R:X2}{color.G:X2}{color.B:X2}";
        }
        Post(new
        {
            type = "theme",
            background = Color(EnvironmentColors.ToolWindowBackgroundColorKey),
            foreground = Color(EnvironmentColors.ToolWindowTextColorKey),
            border = Color(EnvironmentColors.ToolWindowBorderColorKey),
            button = Color(EnvironmentColors.SystemHighlightColorKey),
            buttonText = Color(EnvironmentColors.SystemHighlightTextColorKey),
            focus = Color(EnvironmentColors.SystemHighlightColorKey),
            secondary = Color(EnvironmentColors.CommandBarGradientBeginColorKey)
        });
    }

    private void Celebrated(object? sender, EventArgs e)
    {
        if (loaded && IsVisible) Post(new { type = "celebrate" });
    }

    private void Post(object value)
    {
        if (disposed || !ready || browser?.CoreWebView2 == null) return;
        try { browser.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(value)); }
        catch (COMException ex) { ShowError(ex); }
        catch (InvalidOperationException ex) { ShowError(ex); }
    }

    private void ShowError(Exception error)
    {
        ready = false;
        status.Text = "The party view is unavailable: " + error.Message +
            " Retry after resolving the problem. You can still restore decorations here or from the Bananify menu.";
        fallback.Visibility = Visibility.Visible;
        retry.IsEnabled = true;
        ReleaseBrowser();
        ActivityLog.LogWarning("Bananify", error.Message);
    }

    private void ReleaseBrowser()
    {
        ready = false;
        if (browser == null) return;
        var core = browser.CoreWebView2;
        if (core != null)
        {
            core.WebResourceRequested -= ResourceRequested;
            core.NavigationStarting -= NavigationStarting;
            core.FrameNavigationStarting -= FrameNavigationStarting;
            core.NewWindowRequested -= NewWindowRequested;
            core.PermissionRequested -= PermissionRequested;
            core.DownloadStarting -= DownloadStarting;
            core.WebMessageReceived -= MessageReceived;
            core.NavigationCompleted -= NavigationCompleted;
            core.ProcessFailed -= ProcessFailed;
        }
        layout.Children.Remove(browser);
        browser.Dispose();
        browser = null;
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        Unsubscribe();
        Loaded -= OnLoaded;
        Unloaded -= OnUnloaded;
        IsVisibleChanged -= VisibilityChanged;
        retry.Click -= Retry;
        restore.Click -= Restore;
        ReleaseBrowser();
    }
}
