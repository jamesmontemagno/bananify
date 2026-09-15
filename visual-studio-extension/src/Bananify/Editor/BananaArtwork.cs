using System.Collections.Generic;
using System.Windows;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Media;

namespace Bananify.Editor;

internal sealed class DecorativeImage : Image
{
    protected override AutomationPeer? OnCreateAutomationPeer() => null;
}

internal static class BananaArtwork
{
    private static readonly Dictionary<string, ImageSource> Monkeys = new Dictionary<string, ImageSource>
    {
        ["brown"] = CreateMonkey("#765039", "#f6dab0", "#482b21", "#765039"),
        ["black-and-white"] = CreateMonkey("#303334", "#faf8ed", "#191e20", "#303334"),
        ["golden"] = CreateMonkey("#c39137", "#fff0cb", "#50351f", "#7c8065")
    };

    public static ImageSource Banana { get; } = CreateBanana();
    public static ImageSource Monkey(string id) => Monkeys[id];

    private static Brush Brush(string value)
    {
        var brush = (SolidColorBrush)new BrushConverter().ConvertFromInvariantString(value)!;
        brush.Freeze();
        return brush;
    }

    private static void Path(DrawingContext context, string geometry, string? fill, string stroke, double width) =>
        context.DrawGeometry(fill == null ? null : Brush(fill),
            new Pen(Brush(stroke), width) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round },
            Geometry.Parse(geometry));

    private static ImageSource CreateBanana()
    {
        var group = new DrawingGroup();
        using (var context = group.Open())
        {
            Path(context, "M19 12 C24 39 44 50 68 25 L73 29 C63 66 28 77 13 50 C6 37 8 24 14 13 Z", "#ffda35", "#58351e", 3);
            Path(context, "M16 22 C13 48 36 64 61 41", null, "#fff29b", 5);
            Path(context, "M14 13 L14 7 L19 7 L20 15 M68 25 L73 22 L76 27 L73 30", "#754326", "#58351e", 2);
        }
        var image = new DrawingImage(group);
        image.Freeze();
        return image;
    }

    private static ImageSource CreateMonkey(string fur, string face, string ink, string crown)
    {
        // Head geometry and palettes are from Bananify's original artwork.js, cropped for a legible margin icon.
        var group = new DrawingGroup();
        using (var context = group.Open())
        {
            context.DrawEllipse(Brush(fur), new Pen(Brush(ink), 4), new Point(82, 111), 20, 25);
            context.DrawEllipse(Brush(fur), new Pen(Brush(ink), 4), new Point(199, 111), 20, 25);
            Path(context, "M81 105 C75 58 102 32 139 33 C178 30 204 61 201 108 L194 142 Q182 168 140 170 Q94 168 84 143 Z", crown, ink, 5);
            Path(context, "M90 96 C89 69 115 60 139 83 C161 57 193 69 191 99 L187 133 Q182 155 140 157 Q101 155 93 135 Z", face, face, 0);
            Path(context, "M105 109 Q114 97 123 109 M155 109 Q164 97 173 109", null, ink, 5);
            context.DrawEllipse(Brush(ink), null, new Point(139, 122), 7, 5);
            Path(context, "M120 133 Q139 163 158 133 Z", ink, ink, 3);
            Path(context, "M129 145 Q139 136 150 145 Q141 155 129 145", "#e5867d", "#e5867d", 0);
            Path(context, "M115 43 Q108 28 120 27 L135 38 Q132 17 143 22 L155 39", crown, ink, 5);
        }
        var image = new DrawingImage(group);
        image.Freeze();
        return image;
    }
}
