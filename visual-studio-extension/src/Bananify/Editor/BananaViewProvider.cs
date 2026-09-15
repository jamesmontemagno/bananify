using System.ComponentModel.Composition;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;

namespace Bananify.Editor;

[Export(typeof(IWpfTextViewCreationListener))]
[ContentType("code")]
[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
[TextViewRole(PredefinedTextViewRoles.Editable)]
internal sealed class BananaViewProvider : IWpfTextViewCreationListener
{
    internal const string LayerName = "Bananify.Decorations";

    [Export(typeof(AdornmentLayerDefinition))]
    [Name(LayerName)]
    [Order(After = PredefinedAdornmentLayers.Text, Before = PredefinedAdornmentLayers.Caret)]
    public AdornmentLayerDefinition? Layer { get; set; }

    [Import]
    public ITextDocumentFactoryService Documents { get; set; } = null!;

    public void TextViewCreated(IWpfTextView textView) =>
        textView.Properties.GetOrCreateSingletonProperty(() => new BananaView(textView, Documents));
}
