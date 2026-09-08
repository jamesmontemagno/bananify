using System;

namespace Bananify;

public enum CelebrationKind
{
	Save,
	Build,
	More,
}

public sealed class CelebrationEventArgs : EventArgs
{
	public CelebrationEventArgs(CelebrationKind kind) => Kind = kind;
	public CelebrationKind Kind { get; }
}
