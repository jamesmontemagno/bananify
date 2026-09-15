using System;
using System.Collections.Generic;

namespace Bananify.Core;

public static class DecorationRules
{
    public static uint Hash(string value)
    {
        if (value == null) throw new ArgumentNullException(nameof(value));
        uint result = 2166136261;
        for (int i = 0; i < value.Length; i++)
        {
            uint character = value[i];
            if (char.IsHighSurrogate(value[i]) && i + 1 < value.Length && char.IsLowSurrogate(value[i + 1]))
                character = (uint)char.ConvertToUtf32(value[i], value[++i]);
            result = unchecked((result ^ character) * 16777619);
        }
        return result;
    }

    public static bool ShouldDecorate(string document, int line, int density)
    {
        if (density < 1 || density > 5) throw new ArgumentOutOfRangeException(nameof(density));
        if (line < 0) throw new ArgumentOutOfRangeException(nameof(line));
        return Hash(document + ":" + line) % 100 < density * 8;
    }

    public static int Variant(string document, int line, int count)
    {
        if (count <= 0) throw new ArgumentOutOfRangeException(nameof(count));
        return (int)(Hash("variant:" + document + ":" + line) % count);
    }

    public static HashSet<string> NormalizeVisibleDocuments(IEnumerable<string> paths)
    {
        if (paths == null) throw new ArgumentNullException(nameof(paths));
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (string path in paths)
        {
            if (string.IsNullOrWhiteSpace(path))
                throw new ArgumentException("Visible document paths cannot be empty.", nameof(paths));
            result.Add(path);
        }
        return result;
    }
}
