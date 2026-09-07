using System;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace Bananify;

internal sealed class IdeEvents : IVsUpdateSolutionEvents2, IVsRunningDocTableEvents, IDisposable
{
    private readonly IVsSolutionBuildManager2 _build;
    private readonly IVsRunningDocumentTable _documents;
    private uint _buildCookie;
    private uint _documentCookie;
    private bool _cancelled;
    private bool _hasBuild;
    private bool _failed;

    public IdeEvents(IVsSolutionBuildManager2 build, IVsRunningDocumentTable documents)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _build = build;
        _documents = documents;
        ErrorHandler.ThrowOnFailure(_build.AdviseUpdateSolutionEvents(this, out _buildCookie));
        int result = _documents.AdviseRunningDocTableEvents(this, out _documentCookie);
        if (ErrorHandler.Failed(result))
        {
            ErrorHandler.ThrowOnFailure(_build.UnadviseUpdateSolutionEvents(_buildCookie));
            _buildCookie = 0;
            ErrorHandler.ThrowOnFailure(result);
        }
    }

    public int UpdateSolution_Begin(ref int pfCancelUpdate)
    {
        _cancelled = false;
        _hasBuild = false;
        _failed = false;
        return VSConstants.S_OK;
    }

    public int UpdateSolution_Done(int fSucceeded, int fModified, int fCancelCommand)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        PartySession.Instance.CelebrateBuild(_hasBuild && !_failed && fSucceeded == 1,
            _cancelled || fCancelCommand != 0);
        _hasBuild = false;
        return VSConstants.S_OK;
    }

    public int UpdateSolution_Cancel()
    {
        _cancelled = true;
        return VSConstants.S_OK;
    }

    public int UpdateProjectCfg_Begin(IVsHierarchy hierarchy, IVsCfg projectConfig, IVsCfg solutionConfig,
        uint action, ref int cancel)
    {
        _hasBuild |= ((VSSOLNBUILDUPDATEFLAGS)action & VSSOLNBUILDUPDATEFLAGS.SBF_OPERATION_BUILD) != 0;
        return VSConstants.S_OK;
    }

    public int UpdateProjectCfg_Done(IVsHierarchy hierarchy, IVsCfg projectConfig, IVsCfg solutionConfig,
        uint action, int success, int cancel)
    {
        if (((VSSOLNBUILDUPDATEFLAGS)action & VSSOLNBUILDUPDATEFLAGS.SBF_OPERATION_BUILD) != 0)
        {
            _failed |= success == 0;
            _cancelled |= cancel != 0;
        }
        return VSConstants.S_OK;
    }

    public int OnAfterSave(uint docCookie)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        PartySession.Instance.CelebrateSave();
        return VSConstants.S_OK;
    }

    public int UpdateSolution_StartUpdate(ref int cancel) => VSConstants.S_OK;
    public int OnActiveProjectCfgChange(IVsHierarchy hierarchy) => VSConstants.S_OK;
    public int OnAfterAttributeChange(uint docCookie, uint attributes) => VSConstants.S_OK;
    public int OnAfterDocumentWindowHide(uint docCookie, IVsWindowFrame frame) => VSConstants.S_OK;
    public int OnAfterFirstDocumentLock(uint docCookie, uint lockType, uint readLocks, uint editLocks) => VSConstants.S_OK;
    public int OnBeforeDocumentWindowShow(uint docCookie, int firstShow, IVsWindowFrame frame) => VSConstants.S_OK;
    public int OnBeforeLastDocumentUnlock(uint docCookie, uint lockType, uint readLocks, uint editLocks) => VSConstants.S_OK;

    public void Dispose()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (_documentCookie != 0)
        {
            ErrorHandler.ThrowOnFailure(_documents.UnadviseRunningDocTableEvents(_documentCookie));
            _documentCookie = 0;
        }
        if (_buildCookie != 0)
        {
            ErrorHandler.ThrowOnFailure(_build.UnadviseUpdateSolutionEvents(_buildCookie));
            _buildCookie = 0;
        }
    }
}
