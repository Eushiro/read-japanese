#!/usr/bin/env python3
"""
Compare different MeCab dictionaries for Japanese tokenization quality.

Tests: ipadic, unidic-lite, unidic (full)
"""
import sys
sys.path.insert(0, '.')

import fugashi

# Test cases
COMMON_READINGS = {
    "私": "わたし",
    "今日": "きょう",
    "明日": "あした",
    "昨日": "きのう",
    "友達": "ともだち",
    "土曜日": "どようび",
    "大人": "おとな",
    "子供": "こども",
    "上手": "じょうず",
    "下手": "へた",
}

YOJIJUKUGO = [
    "一期一会",
    "四面楚歌",
    "温故知新",
    "自画自賛",
    "一石二鳥",
    "万物流転",
    "七転八倒",
    "弱肉強食",
]

KATAKANA = [
    "スマートフォン",
    "インターネット",
    "コンピューター",
]


def get_reading(tagger, word, dict_type):
    """Get reading for a word from the tagger."""
    tokens = list(tagger(word))
    if not tokens:
        return None

    # Get reading from feature tuple
    # IPADIC: (pos1, pos2, pos3, pos4, conj1, conj2, base, reading, pronunciation)
    # UniDic: different format
    feature = tokens[0].feature

    if dict_type == "ipadic":
        if len(feature) > 7 and feature[7] != '*':
            reading = feature[7]
            # Convert katakana to hiragana
            return katakana_to_hiragana(reading)
    else:  # unidic
        # UniDic stores reading differently
        # Try common positions
        for idx in [6, 7, 8, 9, 10]:
            if len(feature) > idx and feature[idx] and feature[idx] != '*':
                reading = feature[idx]
                if is_japanese(reading):
                    return katakana_to_hiragana(reading)
    return None


def katakana_to_hiragana(text):
    """Convert katakana to hiragana."""
    if not text:
        return text
    result = []
    for char in text:
        code = ord(char)
        if 0x30A1 <= code <= 0x30F6:
            result.append(chr(code - 0x60))
        else:
            result.append(char)
    return ''.join(result)


def is_japanese(text):
    """Check if text contains Japanese characters."""
    for char in text:
        code = ord(char)
        if 0x3040 <= code <= 0x30FF or 0x4E00 <= code <= 0x9FFF:
            return True
    return False


def is_single_token(tagger, word):
    """Check if word is tokenized as a single token."""
    tokens = list(tagger(word))
    if len(tokens) == 1 and tokens[0].surface == word:
        return True, [word]
    return False, [t.surface for t in tokens]


def test_dictionary(name, tagger, dict_type):
    """Test a dictionary and return results."""
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"{'='*60}")

    results = {
        "common_readings": {"passed": 0, "total": 0, "details": []},
        "yojijukugo": {"passed": 0, "total": 0, "details": []},
        "katakana": {"passed": 0, "total": 0, "details": []},
    }

    # Test common readings
    print("\nCommon Readings:")
    for word, expected in COMMON_READINGS.items():
        results["common_readings"]["total"] += 1
        actual = get_reading(tagger, word, dict_type)
        passed = actual == expected
        if passed:
            results["common_readings"]["passed"] += 1
            print(f"  ✓ {word} = {actual}")
        else:
            print(f"  ✗ {word}: expected={expected}, got={actual}")
        results["common_readings"]["details"].append({
            "word": word, "expected": expected, "actual": actual, "passed": passed
        })

    # Test yojijukugo
    print("\nYojijukugo (should be single token):")
    for word in YOJIJUKUGO:
        results["yojijukugo"]["total"] += 1
        single, tokens = is_single_token(tagger, word)
        if single:
            results["yojijukugo"]["passed"] += 1
            print(f"  ✓ {word}")
        else:
            print(f"  ✗ {word} -> {tokens}")
        results["yojijukugo"]["details"].append({
            "word": word, "is_single": single, "tokens": tokens
        })

    # Test katakana
    print("\nKatakana Compounds:")
    for word in KATAKANA:
        results["katakana"]["total"] += 1
        single, tokens = is_single_token(tagger, word)
        if single:
            results["katakana"]["passed"] += 1
            print(f"  ✓ {word}")
        else:
            print(f"  ✗ {word} -> {tokens}")
        results["katakana"]["details"].append({
            "word": word, "is_single": single, "tokens": tokens
        })

    # Summary
    total_passed = sum(r["passed"] for r in results.values())
    total_tests = sum(r["total"] for r in results.values())

    print(f"\n--- Summary for {name} ---")
    print(f"Common Readings: {results['common_readings']['passed']}/{results['common_readings']['total']}")
    print(f"Yojijukugo: {results['yojijukugo']['passed']}/{results['yojijukugo']['total']}")
    print(f"Katakana: {results['katakana']['passed']}/{results['katakana']['total']}")
    print(f"TOTAL: {total_passed}/{total_tests} ({total_passed/total_tests*100:.1f}%)")

    return results, total_passed, total_tests


def main():
    all_results = {}

    # Test IPADIC
    try:
        import ipadic
        tagger = fugashi.GenericTagger(ipadic.MECAB_ARGS)
        results, passed, total = test_dictionary("fugashi + ipadic", tagger, "ipadic")
        all_results["ipadic"] = (passed, total)
    except Exception as e:
        print(f"IPADIC error: {e}")

    # Test UniDic-lite
    try:
        import unidic_lite
        # Create mecabrc arg
        mecabrc = f'-r /dev/null -d "{unidic_lite.DICDIR}"'
        tagger = fugashi.GenericTagger(mecabrc)
        results, passed, total = test_dictionary("fugashi + unidic-lite", tagger, "unidic")
        all_results["unidic-lite"] = (passed, total)
    except Exception as e:
        print(f"UniDic-lite error: {e}")

    # Test UniDic (full)
    try:
        import unidic
        if unidic.DICDIR:
            # Create mecabrc arg
            mecabrc = f'-r /dev/null -d "{unidic.DICDIR}"'
            tagger = fugashi.GenericTagger(mecabrc)
            results, passed, total = test_dictionary("fugashi + unidic (full)", tagger, "unidic")
            all_results["unidic"] = (passed, total)
    except Exception as e:
        print(f"UniDic error: {e}")

    # Final comparison
    print("\n" + "="*60)
    print("FINAL COMPARISON")
    print("="*60)

    for name, (passed, total) in sorted(all_results.items(), key=lambda x: -x[1][0]):
        pct = passed/total*100
        print(f"{name:20} {passed:2}/{total} ({pct:5.1f}%)")


if __name__ == "__main__":
    main()
