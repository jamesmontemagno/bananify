using System;
using System.Collections.Generic;
using System.Linq;
using Bananify.Core;
using Xunit;

namespace Bananify.Tests;

public sealed class EncouragementTests
{
	[Fact]
	public void EveryPhraseIsDistinctNonemptyAndFitsThePanelMessageLimit()
	{
		var phrases = Enumerable.Range(0, 40)
			.Select(index => new EncouragementProvider(new SequenceRandom(index)).Next()).ToArray();
		Assert.Equal(40, phrases.Distinct(StringComparer.Ordinal).Count());
		Assert.All(phrases, phrase =>
		{
			Assert.False(string.IsNullOrWhiteSpace(phrase));
			Assert.True(("Sebastian says: " + phrase).Length <= 512);
		});
	}

	[Theory]
	[InlineData(0)]
	[InlineData(17)]
	[InlineData(39)]
	public void EachOtherPhraseIsReachableWithoutRetryingTheRandomSource(int previous)
	{
		var expected = Enumerable.Range(0, 40)
			.Select(index => new EncouragementProvider(new SequenceRandom(index)).Next()).ToArray();
		var seen = new HashSet<string>();
		for (var draw = 0; draw < 39; draw++)
		{
			var random = new SequenceRandom(previous, draw);
			var provider = new EncouragementProvider(random);
			Assert.Equal(expected[previous], provider.Next());
			var next = provider.Next();
			Assert.Equal(expected[draw >= previous ? draw + 1 : draw], next);
			Assert.NotEqual(expected[previous], next);
			Assert.True(seen.Add(next));
			Assert.Equal(new[] { 40, 39 }, random.Bounds);
		}
	}

	[Fact]
	public void RepeatedLowestDrawStillDoesNotRepeatAPhrase()
	{
		var provider = new EncouragementProvider(new SequenceRandom(0, 0, 0, 0));
		var first = provider.Next();
		var second = provider.Next();
		Assert.NotEqual(first, second);
		Assert.Equal(first, provider.Next());
		Assert.Equal(second, provider.Next());
	}

	[Fact]
	public void ASeedProducesDeterministicNonrepeatingSequences()
	{
		var first = new EncouragementProvider(new Random(42));
		var second = new EncouragementProvider(new Random(42));
		string? previous = null;
		for (var i = 0; i < 1000; i++)
		{
			var phrase = first.Next();
			Assert.Equal(phrase, second.Next());
			Assert.NotEqual(previous, phrase);
			previous = phrase;
		}
	}

	[Fact]
	public void NullRandomIsRejected() =>
		Assert.Throws<ArgumentNullException>(() => new EncouragementProvider(null!));

	private sealed class SequenceRandom : Random
	{
		private readonly Queue<int> _values;
		public List<int> Bounds { get; } = new();

		public SequenceRandom(params int[] values) => _values = new Queue<int>(values);

		public override int Next(int maxValue)
		{
			Bounds.Add(maxValue);
			var value = _values.Dequeue();
			Assert.InRange(value, 0, maxValue - 1);
			return value;
		}
	}
}
