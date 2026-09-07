using System;
using System.ComponentModel;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using Bananify.Options;
using Bananify.ToolWindows;
using Community.VisualStudio.Toolkit;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace Bananify;

[PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
[InstalledProductRegistration("Bananify", "A local banana party for Visual Studio.", "0.1.0")]
[ProvideMenuResource("Menus.ctmenu", 1)]
[ProvideAutoLoad(VSConstants.UICONTEXT.ShellInitialized_string, PackageAutoLoadFlags.BackgroundLoad)]
[ProvideOptionPage(typeof(BananifyOptions), "Bananify", "General", 0, 0, true)]
[ProvideToolWindow(typeof(PartyToolWindow), Style = VsDockStyle.Tabbed, Window = ToolWindowGuids.SolutionExplorer)]
[ProvideToolWindow(typeof(PartyDocumentWindow), Style = VsDockStyle.MDI)]
[Guid(PackageGuid)]
public sealed class BananifyPackage : ToolkitPackage
{
    public const string PackageGuid = "34b4207e-5102-4332-96fa-ce788f830550";
    private static readonly Guid CommandSet = new Guid("c2bfb169-1b41-4e8d-8975-87e81d5f890f");
    private IdeEvents? _events;

    protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
    {
        var commands = (OleMenuCommandService?)await GetServiceAsync(typeof(IMenuCommandService));
        object? buildService = await GetServiceAsync(typeof(SVsSolutionBuildManager));
        object? documentService = await GetServiceAsync(typeof(SVsRunningDocumentTable));
        await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
        var build = buildService as IVsSolutionBuildManager2;
        var documents = documentService as IVsRunningDocumentTable;
        if (commands == null || build == null || documents == null)
            throw new InvalidOperationException("Bananify could not acquire the Visual Studio command, build, or document service.");

        PartySession.Instance.ApplyOptions((BananifyOptions)GetDialogPage(typeof(BananifyOptions)));
        PartySession.Instance.Changed += OnPartyStateChanged;
        SystemParameters.StaticPropertyChanged += OnSystemPreferenceChanged;
        AddCommand(commands, 0x0100, Toggle);
        AddCommand(commands, 0x0101, PartySession.Instance.More);
        AddCommand(commands, 0x0102, PartySession.Instance.PauseOrResume);
        AddCommand(commands, 0x0103, Restore);
        AddAsyncCommand(commands, 0x0104, () => OpenPartyAsync(false));
        AddAsyncCommand(commands, 0x0105, () => OpenPartyAsync(true));
        AddCommand(commands, 0x0106, ShowSettings);
        AddCommand(commands, 0x0107, Cheer);
        _events = new IdeEvents(build, documents);
    }

    private static void AddCommand(OleMenuCommandService service, int id, Action action)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        service.AddCommand(new OleMenuCommand((_, _) => action(), new CommandID(CommandSet, id)));
    }

    [System.Diagnostics.CodeAnalysis.SuppressMessage("Usage", "VSTHRD101",
        Justification = "Visual Studio command event boundary; expected command failures are surfaced below.")]
    private void AddAsyncCommand(OleMenuCommandService service, int id, Func<Task> action)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        service.AddCommand(new OleMenuCommand(async (_, _) =>
        {
            try
            {
                await action();
            }
            catch (OperationCanceledException) when (DisposalToken.IsCancellationRequested)
            {
                // The IDE is shutting down.
            }
            catch (COMException error)
            {
                await JoinableTaskFactory.SwitchToMainThreadAsync();
                ShowCommandError(error.Message);
            }
            catch (InvalidOperationException error)
            {
                await JoinableTaskFactory.SwitchToMainThreadAsync();
                ShowCommandError(error.Message);
            }
        }, new CommandID(CommandSet, id)));
    }

    private void ShowCommandError(string message)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        ActivityLog.LogError("Bananify", message);
        VsShellUtilities.ShowMessageBox(this, message, "Bananify could not open the party",
            OLEMSGICON.OLEMSGICON_WARNING, OLEMSGBUTTON.OLEMSGBUTTON_OK, OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
    }

    private void Toggle()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (PartySession.Instance.State.Active) Restore();
        else PartySession.Instance.Start();
    }

    private void Restore()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        PartySession.Instance.Restore();
    }

    private void OnPartyStateChanged(object? sender, EventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (PartySession.Instance.State.Active) return;
        var document = FindToolWindow(typeof(PartyDocumentWindow), 0, false);
        if (document?.Frame is IVsWindowFrame frame)
            ErrorHandler.ThrowOnFailure(frame.Hide());
    }

    private async Task OpenPartyAsync(bool large)
    {
        await JoinableTaskFactory.SwitchToMainThreadAsync(DisposalToken);
        PartySession.Instance.Start();
        var window = await ShowToolWindowAsync(large ? typeof(PartyDocumentWindow) : typeof(PartyToolWindow),
            0, true, DisposalToken);
        if (window?.Frame == null)
            throw new InvalidOperationException("Visual Studio could not open the Bananify party window.");
    }

    private void ShowSettings()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        ShowOptionPage(typeof(BananifyOptions));
    }

    private void Cheer()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        VsShellUtilities.ShowMessageBox(this,
            PartySession.Instance.State.MonkeyName + " says: One small commit is still a big step forward.",
            "Bananify", OLEMSGICON.OLEMSGICON_INFO, OLEMSGBUTTON.OLEMSGBUTTON_OK, OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
    }

    [System.Diagnostics.CodeAnalysis.SuppressMessage("Usage", "VSTHRD100",
        Justification = "WPF system-preference event boundary with shutdown cancellation handled.")]
    private async void OnSystemPreferenceChanged(object? sender, PropertyChangedEventArgs e)
    {
        try
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync(DisposalToken);
            PartySession.Instance.RefreshSystemPreferences();
        }
        catch (OperationCanceledException) when (DisposalToken.IsCancellationRequested)
        {
            // No visual update is needed once the package is shutting down.
        }
    }

    protected override void Dispose(bool disposing)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (disposing)
        {
            SystemParameters.StaticPropertyChanged -= OnSystemPreferenceChanged;
            PartySession.Instance.Changed -= OnPartyStateChanged;
            _events?.Dispose();
            PartySession.Instance.Shutdown();
        }
        base.Dispose(disposing);
    }
}
