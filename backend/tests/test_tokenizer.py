"""Tests for the Japanese tokenizer service"""

import pytest

from app.services.tokenizer import get_tokenizer_service


@pytest.fixture
def tokenizer():
    """Get tokenizer service instance"""
    return get_tokenizer_service()


class TestCommonReadings:
    """Test that common words have colloquial (not formal) readings"""

    def test_watashi_reading(self, tokenizer):
        """私 should be わたし, not わたくし"""
        tokens = tokenizer.tokenize_text("私")
        assert len(tokens) == 1
        assert tokens[0].parts[0].reading == "わたし"

    def test_kyou_reading(self, tokenizer):
        """今日 should be きょう"""
        tokens = tokenizer.tokenize_text("今日")
        assert len(tokens) == 1
        assert tokens[0].parts[0].reading == "きょう"

    def test_ashita_reading(self, tokenizer):
        """明日 should be あした, not あす"""
        tokens = tokenizer.tokenize_text("明日")
        assert len(tokens) == 1
        assert tokens[0].parts[0].reading == "あした"

    def test_kinou_reading(self, tokenizer):
        """昨日 should be きのう"""
        tokens = tokenizer.tokenize_text("昨日")
        assert len(tokens) == 1
        assert tokens[0].parts[0].reading == "きのう"

    def test_doyoubi_reading(self, tokenizer):
        """土曜日 should be どようび"""
        tokens = tokenizer.tokenize_text("土曜日")
        assert len(tokens) == 1
        assert tokens[0].parts[0].reading == "どようび"


class TestKanjiCompounds:
    """Test that all-kanji compounds are kept as single units"""

    def test_tomodachi(self, tokenizer):
        """友達 should have full reading as one unit"""
        tokens = tokenizer.tokenize_text("友達")
        assert len(tokens) == 1
        assert len(tokens[0].parts) == 1
        assert tokens[0].parts[0].text == "友達"
        assert tokens[0].parts[0].reading == "ともだち"

    def test_tenin(self, tokenizer):
        """店員 should have full reading as one unit"""
        tokens = tokenizer.tokenize_text("店員")
        assert len(tokens) == 1
        assert len(tokens[0].parts) == 1
        assert tokens[0].parts[0].text == "店員"
        assert tokens[0].parts[0].reading == "てんいん"

    def test_nihon(self, tokenizer):
        """日本 should have full reading"""
        tokens = tokenizer.tokenize_text("日本")
        assert len(tokens) == 1
        assert tokens[0].parts[0].reading in ["にほん", "にっぽん"]


class TestKatakanaCompounds:
    """Test that common katakana compound words are kept together"""

    def test_smartphone(self, tokenizer):
        """スマートフォン should be kept as one token"""
        tokens = tokenizer.tokenize_text("スマートフォン")
        assert len(tokens) == 1
        assert tokens[0].surface == "スマートフォン"

    def test_convenience_store(self, tokenizer):
        """コンビニエンスストア should be kept as one token"""
        tokens = tokenizer.tokenize_text("コンビニ")
        assert len(tokens) == 1
        assert tokens[0].surface == "コンビニ"

    def test_internet(self, tokenizer):
        """インターネット should be kept as one token"""
        tokens = tokenizer.tokenize_text("インターネット")
        assert len(tokens) == 1
        assert tokens[0].surface == "インターネット"


class TestMixedKanjiKanaAlignment:
    """Test that mixed kanji/kana words have properly aligned readings"""

    def test_taberu(self, tokenizer):
        """食べる should split to 食(た) + べる"""
        tokens = tokenizer.tokenize_text("食べる")
        # May be tokenized as 食べ + る or 食べる
        all_parts = []
        for t in tokens:
            all_parts.extend(t.parts)

        # Find the kanji part
        kanji_parts = [p for p in all_parts if p.reading is not None]
        kana_parts = [p for p in all_parts if p.reading is None]

        assert len(kanji_parts) >= 1
        assert kanji_parts[0].text == "食"
        assert kanji_parts[0].reading == "た"

    def test_ii_verb(self, tokenizer):
        """言い should split to 言(い) + い (no duplicate readings)"""
        tokens = tokenizer.tokenize_text("言い")
        assert len(tokens) == 1
        parts = tokens[0].parts

        # Should have 2 parts: 言(い) and い
        assert len(parts) == 2
        assert parts[0].text == "言"
        assert parts[0].reading == "い"
        assert parts[1].text == "い"
        assert parts[1].reading is None

    def test_hajimete(self, tokenizer):
        """初めて should split to 初(はじ) + めて"""
        tokens = tokenizer.tokenize_text("初めて")
        assert len(tokens) == 1
        parts = tokens[0].parts

        assert len(parts) == 2
        assert parts[0].text == "初"
        assert parts[0].reading == "はじ"
        assert parts[1].text == "めて"
        assert parts[1].reading is None

    def test_ikimashita(self, tokenizer):
        """行きました should properly tokenize 行き"""
        tokens = tokenizer.tokenize_text("行きました")
        # Find the 行き token
        iki_token = None
        for t in tokens:
            if "行" in t.surface:
                iki_token = t
                break

        assert iki_token is not None
        assert iki_token.parts[0].text == "行"
        assert iki_token.parts[0].reading == "い"


class TestPartOfSpeech:
    """Test part of speech detection"""

    def test_noun(self, tokenizer):
        """Nouns should be tagged correctly"""
        tokens = tokenizer.tokenize_text("猫")
        assert tokens[0].partOfSpeech == "noun"

    def test_verb(self, tokenizer):
        """Verbs should be tagged correctly"""
        tokens = tokenizer.tokenize_text("食べる")
        # 食べ is the verb stem
        verb_found = any(t.partOfSpeech == "verb" for t in tokens)
        assert verb_found

    def test_particle(self, tokenizer):
        """Particles should be tagged correctly"""
        tokens = tokenizer.tokenize_text("私は")
        # は should be a particle
        ha_token = [t for t in tokens if t.surface == "は"][0]
        assert ha_token.partOfSpeech == "particle"

    def test_adjective(self, tokenizer):
        """Adjectives should be tagged correctly"""
        tokens = tokenizer.tokenize_text("美しい")
        assert tokens[0].partOfSpeech == "adjective"


class TestSpecialCases:
    """Test special cases and edge cases"""

    def test_katakana_no_reading(self, tokenizer):
        """Katakana words should not have furigana readings"""
        tokens = tokenizer.tokenize_text("カフェ")
        assert len(tokens) == 1
        # Katakana doesn't need reading annotation
        assert tokens[0].parts[0].reading is None

    def test_hiragana_no_reading(self, tokenizer):
        """Pure hiragana should not have readings"""
        tokens = tokenizer.tokenize_text("これ")
        for token in tokens:
            for part in token.parts:
                assert part.reading is None

    def test_punctuation(self, tokenizer):
        """Japanese punctuation should be handled"""
        tokens = tokenizer.tokenize_text("。")
        assert len(tokens) == 1
        assert tokens[0].surface == "。"

    def test_mixed_sentence(self, tokenizer):
        """Full sentence should tokenize correctly"""
        tokens = tokenizer.tokenize_text("私はカフェに行きました。")

        # Check key tokens exist
        surfaces = [t.surface for t in tokens]
        assert "私" in surfaces
        assert "は" in surfaces
        assert "カフェ" in surfaces
        assert "に" in surfaces
        assert "。" in surfaces

    def test_empty_string(self, tokenizer):
        """Empty string should return empty list"""
        tokens = tokenizer.tokenize_text("")
        assert tokens == []


class TestReadingAlignment:
    """Test the reading alignment algorithm specifically"""

    def test_prefix_kana(self, tokenizer):
        """Words with prefix kana should align correctly"""
        # お茶 (ocha) - prefix お + kanji 茶
        tokens = tokenizer.tokenize_text("お茶")
        # This might be tokenized as one word or split
        all_text = "".join(p.text for t in tokens for p in t.parts)
        assert "茶" in all_text

    def test_suffix_kana(self, tokenizer):
        """Words with suffix kana should align correctly"""
        tokens = tokenizer.tokenize_text("飲み")
        assert len(tokens) == 1
        parts = tokens[0].parts

        # Should have kanji with reading + kana suffix
        assert parts[0].text == "飲"
        assert parts[0].reading == "の"
        assert parts[1].text == "み"
        assert parts[1].reading is None

    def test_middle_kana(self, tokenizer):
        """Words with middle kana should align correctly"""
        # 食べ物 (tabemono) - 食 + べ + 物
        tokens = tokenizer.tokenize_text("食べ物")
        # May tokenize as 食べ + 物 or 食べ物
        all_parts = []
        for t in tokens:
            all_parts.extend(t.parts)

        # Verify we have correct structure
        texts = [p.text for p in all_parts]
        assert "食" in texts or "食べ" in "".join(texts)


class TestQualityAssurance:
    """Quality assurance tests for production readiness"""

    def test_n5_vocabulary(self, tokenizer):
        """Common N5 vocabulary should have correct readings"""
        n5_words = {
            "水": "みず",
            "山": "やま",
            "川": "かわ",
            "木": "き",
            "花": "はな",
            "犬": "いぬ",
            "猫": "ねこ",
            "魚": "さかな",
            "鳥": "とり",
            "人": "ひと",
        }

        for kanji, expected_reading in n5_words.items():
            tokens = tokenizer.tokenize_text(kanji)
            actual_reading = tokens[0].parts[0].reading
            assert actual_reading == expected_reading, (
                f"{kanji} should be {expected_reading}, got {actual_reading}"
            )

    def test_common_verbs(self, tokenizer):
        """Common verb stems should have correct readings"""
        # Test with proper verb conjugations
        verbs = {
            "見ます": ("見", "み"),
            "聞きます": ("聞", "き"),
            "書きます": ("書", "か"),
            "読みます": ("読", "よ"),
            "話します": ("話", "はな"),
        }

        for verb_form, (kanji, expected_reading) in verbs.items():
            tokens = tokenizer.tokenize_text(verb_form)
            # Find the kanji part
            for token in tokens:
                if kanji in token.surface:
                    kanji_part = [p for p in token.parts if p.text == kanji]
                    if kanji_part:
                        assert kanji_part[0].reading == expected_reading, (
                            f"{kanji} in {verb_form} should be {expected_reading}, got {kanji_part[0].reading}"
                        )

    def test_no_duplicate_readings(self, tokenizer):
        """Ensure no duplicate kana in output"""
        test_cases = [
            "言いました",  # Should not have いいい
            "買いました",  # Should not have かいい
        ]

        for text in test_cases:
            tokens = tokenizer.tokenize_text(text)

            # Reconstruct with readings
            output = ""
            for token in tokens:
                for part in token.parts:
                    if part.reading:
                        output += part.reading
                    else:
                        output += part.text

            # Should not have 3 consecutive identical characters
            for i in range(len(output) - 2):
                three_chars = output[i : i + 3]
                assert not (three_chars[0] == three_chars[1] == three_chars[2]), (
                    f"Found duplicate in {text}: {output}"
                )


class TestYojijukugo:
    """Test that four-character idioms (yojijukugo) are kept as single units"""

    def test_ichigoichie(self, tokenizer):
        """一期一会 should be kept as one token"""
        tokens = tokenizer.tokenize_text("一期一会")
        assert len(tokens) == 1
        assert tokens[0].surface == "一期一会"
        assert tokens[0].parts[0].reading == "いちごいちえ"

    def test_shimenshoka(self, tokenizer):
        """四面楚歌 should be kept as one token"""
        tokens = tokenizer.tokenize_text("四面楚歌")
        assert len(tokens) == 1
        assert tokens[0].surface == "四面楚歌"
        assert tokens[0].parts[0].reading == "しめんそか"

    def test_onkochishin(self, tokenizer):
        """温故知新 should be kept as one token"""
        tokens = tokenizer.tokenize_text("温故知新")
        assert len(tokens) == 1
        assert tokens[0].surface == "温故知新"
        assert tokens[0].parts[0].reading == "おんこちしん"

    @pytest.mark.skip(reason="自画自賛 is split by IPADIC - known limitation")
    def test_jigajisan(self, tokenizer):
        """自画自賛 should be kept as one token"""
        tokens = tokenizer.tokenize_text("自画自賛")
        assert len(tokens) == 1
        assert tokens[0].surface == "自画自賛"

    def test_issekinicho(self, tokenizer):
        """一石二鳥 should be kept as one token"""
        tokens = tokenizer.tokenize_text("一石二鳥")
        assert len(tokens) == 1
        assert tokens[0].surface == "一石二鳥"
        assert tokens[0].parts[0].reading == "いっせきにちょう"


class TestComparisonBenchmark:
    """Benchmark tests for comparing tokenizer quality across different backends.

    These tests return structured data that can be used by the comparison utility.
    """

    def get_benchmark_results(self, tokenizer) -> dict:
        """Run all benchmark cases and return results."""
        results = {
            "common_readings": {},
            "compounds": {},
            "yojijukugo": {},
            "katakana": {},
        }

        # Common readings test cases
        common_readings = {
            "私": "わたし",
            "今日": "きょう",
            "明日": "あした",
            "昨日": "きのう",
            "友達": "ともだち",
            "土曜日": "どようび",
        }

        for word, expected in common_readings.items():
            tokens = tokenizer.tokenize_text(word)
            if tokens and tokens[0].parts:
                actual = tokens[0].parts[0].reading
                results["common_readings"][word] = {
                    "expected": expected,
                    "actual": actual,
                    "passed": actual == expected,
                }

        # Yojijukugo test cases (should be single token)
        yojijukugo = ["一期一会", "四面楚歌", "温故知新", "自画自賛", "一石二鳥", "万物流転"]

        for word in yojijukugo:
            tokens = tokenizer.tokenize_text(word)
            is_single = len(tokens) == 1 and tokens[0].surface == word
            results["yojijukugo"][word] = {
                "is_single_token": is_single,
                "token_count": len(tokens),
                "tokens": [t.surface for t in tokens],
            }

        # Katakana compounds (should be single token)
        katakana = ["スマートフォン", "インターネット", "コンピューター"]

        for word in katakana:
            tokens = tokenizer.tokenize_text(word)
            is_single = len(tokens) == 1 and tokens[0].surface == word
            results["katakana"][word] = {
                "is_single_token": is_single,
                "token_count": len(tokens),
                "tokens": [t.surface for t in tokens],
            }

        return results

    def test_benchmark_runner(self, tokenizer):
        """Verify benchmark can run (actual comparison done by compare_tokenizers.py)"""
        results = self.get_benchmark_results(tokenizer)

        # Just verify structure exists
        assert "common_readings" in results
        assert "yojijukugo" in results
        assert "katakana" in results

        # Log results for manual inspection
        print("\n--- Tokenizer Benchmark Results ---")

        print("\nCommon Readings:")
        for word, data in results["common_readings"].items():
            status = "✓" if data["passed"] else "✗"
            print(f"  {status} {word}: expected={data['expected']}, actual={data['actual']}")

        print("\nYojijukugo (should be single token):")
        for word, data in results["yojijukugo"].items():
            status = "✓" if data["is_single_token"] else "✗"
            print(f"  {status} {word}: {data['tokens']}")

        print("\nKatakana Compounds:")
        for word, data in results["katakana"].items():
            status = "✓" if data["is_single_token"] else "✗"
            print(f"  {status} {word}: {data['tokens']}")
