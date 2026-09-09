using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace Bananify.ToolWindows;

[Guid("2a5b07c9-9d24-46bb-90ea-d42334a2c437")]
public sealed class PartyToolWindow : ToolWindowPane
{
    public PartyToolWindow() : base(null)
    {
        Caption = "Monkey Business";
        Content = new PartyHostControl(compact: true, userDataRoot: () =>
            Package is BananifyPackage package ? package.UserLocalDataPath
                : throw new InvalidOperationException("The party window is not attached to its Visual Studio package."));
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) (Content as IDisposable)?.Dispose();
        base.Dispose(disposing);
    }
}

[Guid("a1b7de14-693e-44a2-875a-81c1e810a051")]
public sealed class PartyDocumentWindow : ToolWindowPane
{
    public PartyDocumentWindow() : base(null)
    {
        Caption = "Banana Party";
        Content = new PartyHostControl(compact: false, userDataRoot: () =>
            Package is BananifyPackage package ? package.UserLocalDataPath
                : throw new InvalidOperationException("The party window is not attached to its Visual Studio package."));
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) (Content as IDisposable)?.Dispose();
        base.Dispose(disposing);
    }
}
