using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace Bananify.Options;

[ComVisible(true)]
public sealed class BananifyOptions : DialogPage
{
    [Category("Party"), DisplayName("Enable decorations"), DefaultValue(false)]
    [Description("Show banana decorations in visible source editors. Source files are never changed.")]
    public bool Enabled { get; set; }

    [Category("Party"), DisplayName("Density (1-5)"), DefaultValue(5)]
    public int Density { get; set; } = 5;

    [Category("Party"), DisplayName("Monkey"), DefaultValue("brown")]
    [Description("brown (Mooch), black-and-white (Sebastian), or golden (Henry).")]
    public string Monkey { get; set; } = "brown";

    [Category("Accessibility"), DisplayName("Reduce motion"), DefaultValue(false)]
    [Description("Use a static party. Windows animation and high-contrast preferences are also respected.")]
    public bool ReducedMotion { get; set; }

    [Category("Solution Explorer"), DisplayName("Enable file badges"), DefaultValue(false)]
    [Description("Add reversible banana badges to visible files in SDK-style C# and VB projects while the party is active.")]
    public bool FileBadgesEnabled { get; set; }

    [Category("Celebrations"), DisplayName("Celebrate completed saves"), DefaultValue(false)]
    public bool CelebrateOnSave { get; set; }

    [Category("Celebrations"), DisplayName("Celebrate successful solution builds"), DefaultValue(false)]
    public bool CelebrateOnBuild { get; set; }

    protected override void OnApply(PageApplyEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (Density < 1 || Density > 5 || !Core.PartyState.IsKnownMonkey(Monkey))
        {
            e.ApplyBehavior = ApplyKind.Cancel;
            System.Windows.MessageBox.Show("Choose a density from 1 to 5 and a monkey of brown, black-and-white, or golden.",
                "Bananify settings", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
            return;
        }
        base.OnApply(e);
        PartySession.Instance.ApplyOptions(this);
    }
}
