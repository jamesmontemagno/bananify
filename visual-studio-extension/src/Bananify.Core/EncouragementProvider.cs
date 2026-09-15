using System;

namespace Bananify.Core;

public sealed class EncouragementProvider
{
	private static readonly string[] Phrases =
	{
		"One small commit is still a big step forward.",
		"Peel back one problem at a time. You do not need to solve the whole bunch today.",
		"A failing test is a clue, not a verdict on your ability.",
		"Your next good idea might arrive after a stretch and a sip of water.",
		"Even the tallest codebase grows one useful line at a time.",
		"You found an edge case. That is careful work worth celebrating.",
		"A clear variable name is a little gift to your future self.",
		"You can take a break without losing your place in the jungle.",
		"A tiny reproducible example can untangle a very big knot.",
		"Progress counts even when it is mostly understanding what not to do.",
		"The bunch is cheering for your next small, testable step.",
		"You do not have to know everything to ask a useful question.",
		"That confusing error message has met a very persistent developer.",
		"One less mystery in the debugger is one more win for you.",
		"Good code has room for tomorrow's lessons.",
		"You are allowed to learn this at your own pace.",
		"A thoughtful test can be the strongest branch in the tree.",
		"Try explaining it to a monkey. We are excellent listeners.",
		"A simpler solution is worth a little extra thinking time.",
		"You spotted something that could be better. That is where good work starts.",
		"Keep your changes small and your snack breaks generous.",
		"The bug is in the code, not in your worth as a developer.",
		"A helpful code review grows the whole bunch.",
		"Yesterday's tricky concept can become tomorrow's familiar tool.",
		"Saving your progress is a perfectly good reason for a tiny celebration.",
		"A green build is nice. Understanding why it is green is even nicer.",
		"You can climb this problem one branch at a time.",
		"A well-placed breakpoint can turn guessing into discovery.",
		"Your careful work on the boring details matters.",
		"There is no shame in checking the documentation again.",
		"A fresh pair of eyes can help. Invite someone into the puzzle.",
		"Make it clear first. The bunch appreciates readable code.",
		"You have solved unfamiliar problems before. This one can become familiar too.",
		"A small fix with a good test is a fine day's contribution.",
		"Not every session needs a breakthrough to be worthwhile.",
		"You are building understanding, not just building software.",
		"A useful error report is a bridge to the next solution.",
		"Refilling your energy is part of finishing the work.",
		"That little improvement might make someone's day easier.",
		"Take a breath. Pick one next step. The monkeys are on your side.",
	};
	private readonly Random _random;
	private int _previous = -1;

	public EncouragementProvider() : this(new Random()) { }

	public EncouragementProvider(Random random) => _random = random ?? throw new ArgumentNullException(nameof(random));

	public string Next()
	{
		var index = _random.Next(Phrases.Length - (_previous < 0 ? 0 : 1));
		if (_previous >= 0 && index >= _previous) index++;
		_previous = index;
		return Phrases[index];
	}
}
