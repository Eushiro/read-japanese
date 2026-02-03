#!/usr/bin/env python3
"""
Tokenizer Comparison Utility

Compare different Japanese tokenizers to evaluate quality for furigana generation.
Run this script when evaluating a new tokenizer/dictionary combination.

Usage:
    python scripts/compare_tokenizers.py [--verbose]

Requirements:
    - Current tokenizer configured in app/services/tokenizer.py
    - Optional: Install additional tokenizers to compare against
"""

import json
import sys
from dataclasses import dataclass
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, ".")

from app.services.tokenizer import get_tokenizer_service


@dataclass
class BenchmarkCase:
    """A single benchmark test case."""

    word: str
    expected_reading: str = None
    expected_single_token: bool = True
    category: str = "general"


# Comprehensive benchmark suite
BENCHMARK_CASES = [
    # Common readings (should match colloquial pronunciation)
    BenchmarkCase("私", "わたし", category="common_readings"),
    BenchmarkCase("今日", "きょう", category="common_readings"),
    BenchmarkCase("明日", "あした", category="common_readings"),
    BenchmarkCase("昨日", "きのう", category="common_readings"),
    BenchmarkCase("友達", "ともだち", category="common_readings"),
    BenchmarkCase("土曜日", "どようび", category="common_readings"),
    BenchmarkCase("日曜日", "にちようび", category="common_readings"),
    BenchmarkCase("大人", "おとな", category="common_readings"),
    BenchmarkCase("子供", "こども", category="common_readings"),
    BenchmarkCase("上手", "じょうず", category="common_readings"),
    BenchmarkCase("下手", "へた", category="common_readings"),
    # Yojijukugo (four-character idioms - should be single token)
    BenchmarkCase("一期一会", "いちごいちえ", category="yojijukugo"),
    BenchmarkCase("四面楚歌", "しめんそか", category="yojijukugo"),
    BenchmarkCase("温故知新", "おんこちしん", category="yojijukugo"),
    BenchmarkCase("自画自賛", "じがじさん", category="yojijukugo"),
    BenchmarkCase("一石二鳥", "いっせきにちょう", category="yojijukugo"),
    BenchmarkCase("万物流転", "ばんぶつるてん", category="yojijukugo"),
    BenchmarkCase("七転八倒", "しちてんばっとう", category="yojijukugo"),
    BenchmarkCase("弱肉強食", "じゃくにくきょうしょく", category="yojijukugo"),
    # Katakana compounds (should be single token)
    BenchmarkCase("スマートフォン", category="katakana"),
    BenchmarkCase("インターネット", category="katakana"),
    BenchmarkCase("コンピューター", category="katakana"),
    BenchmarkCase("アイスクリーム", category="katakana"),
    BenchmarkCase("クレジットカード", category="katakana"),
    # Common kanji compounds (should be single token)
    BenchmarkCase("店員", "てんいん", category="compounds"),
    BenchmarkCase("学校", "がっこう", category="compounds"),
    BenchmarkCase("図書館", "としょかん", category="compounds"),
    BenchmarkCase("新幹線", "しんかんせん", category="compounds"),
    BenchmarkCase("電車", "でんしゃ", category="compounds"),
    # N5 vocabulary
    BenchmarkCase("水", "みず", category="n5"),
    BenchmarkCase("山", "やま", category="n5"),
    BenchmarkCase("川", "かわ", category="n5"),
    BenchmarkCase("木", "き", category="n5"),
    BenchmarkCase("花", "はな", category="n5"),
    BenchmarkCase("犬", "いぬ", category="n5"),
    BenchmarkCase("猫", "ねこ", category="n5"),
]


def run_benchmark(verbose: bool = False) -> dict[str, Any]:
    """Run the benchmark suite and return results."""
    tokenizer = get_tokenizer_service()

    results = {
        "summary": {
            "total": 0,
            "passed": 0,
            "failed": 0,
        },
        "by_category": {},
        "details": [],
    }

    categories = {}

    for case in BENCHMARK_CASES:
        results["summary"]["total"] += 1

        tokens = tokenizer.tokenize_text(case.word)

        # Evaluate results
        is_single_token = len(tokens) == 1 and tokens[0].surface == case.word

        reading = None
        if tokens and tokens[0].parts:
            reading = tokens[0].parts[0].reading

        reading_correct = case.expected_reading is None or reading == case.expected_reading

        passed = is_single_token and reading_correct

        if passed:
            results["summary"]["passed"] += 1
        else:
            results["summary"]["failed"] += 1

        # Track by category
        if case.category not in categories:
            categories[case.category] = {"passed": 0, "total": 0, "cases": []}
        categories[case.category]["total"] += 1
        if passed:
            categories[case.category]["passed"] += 1

        detail = {
            "word": case.word,
            "category": case.category,
            "passed": passed,
            "is_single_token": is_single_token,
            "token_count": len(tokens),
            "tokens": [t.surface for t in tokens],
            "expected_reading": case.expected_reading,
            "actual_reading": reading,
        }

        results["details"].append(detail)
        categories[case.category]["cases"].append(detail)

    results["by_category"] = categories

    # Calculate percentages
    total = results["summary"]["total"]
    results["summary"]["pass_rate"] = results["summary"]["passed"] / total * 100 if total > 0 else 0

    for cat in categories.values():
        cat["pass_rate"] = cat["passed"] / cat["total"] * 100 if cat["total"] > 0 else 0

    return results


def print_results(results: dict[str, Any], verbose: bool = False):
    """Print benchmark results in a readable format."""
    print("\n" + "=" * 60)
    print("TOKENIZER BENCHMARK RESULTS")
    print("=" * 60)

    summary = results["summary"]
    print(f"\nOverall: {summary['passed']}/{summary['total']} passed ({summary['pass_rate']:.1f}%)")

    print("\nBy Category:")
    for cat_name, cat_data in results["by_category"].items():
        status = "✓" if cat_data["pass_rate"] == 100 else "✗"
        print(
            f"  {status} {cat_name}: {cat_data['passed']}/{cat_data['total']} ({cat_data['pass_rate']:.1f}%)"
        )

    if verbose:
        print("\n" + "-" * 60)
        print("DETAILED RESULTS")
        print("-" * 60)

        for cat_name, cat_data in results["by_category"].items():
            print(f"\n{cat_name.upper()}:")
            for case in cat_data["cases"]:
                status = "✓" if case["passed"] else "✗"
                print(f"  {status} {case['word']}")
                if not case["passed"]:
                    if not case["is_single_token"]:
                        print(f"      Split into: {case['tokens']}")
                    if (
                        case["expected_reading"]
                        and case["actual_reading"] != case["expected_reading"]
                    ):
                        print(
                            f"      Reading: expected={case['expected_reading']}, actual={case['actual_reading']}"
                        )

    # Failed cases summary
    failed = [d for d in results["details"] if not d["passed"]]
    if failed:
        print("\n" + "-" * 60)
        print("FAILED CASES")
        print("-" * 60)
        for case in failed:
            print(f"  ✗ {case['word']} ({case['category']})")
            if not case["is_single_token"]:
                print(f"      Split into: {case['tokens']}")
            if case["expected_reading"] and case["actual_reading"] != case["expected_reading"]:
                print(
                    f"      Reading: expected={case['expected_reading']}, actual={case['actual_reading']}"
                )

    print("\n" + "=" * 60)


def main():
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    json_output = "--json" in sys.argv

    results = run_benchmark(verbose)

    if json_output:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print_results(results, verbose)

    # Exit with error code if any tests failed
    sys.exit(0 if results["summary"]["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
