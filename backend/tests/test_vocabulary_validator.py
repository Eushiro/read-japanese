"""Tests for the JLPT vocabulary validator - Learning Value Score Algorithm"""

import pytest

from app.services.generation.vocabulary_validator import (
    get_validator,
)


@pytest.fixture
def validator():
    """Get vocabulary validator instance"""
    return get_validator()


def make_tokens(words: list[str]) -> list[dict]:
    """Helper to create token dicts from word list"""
    return [{"surface": w, "baseForm": w} for w in words]


class TestWordLevelDetection:
    """Test that words are correctly identified by JLPT level"""

    def test_n5_word_detected(self, validator):
        """N5 words should be detected as N5"""
        # 東 (ひがし, east) is N5
        level = validator.get_word_level("東")
        assert level == "N5"

    def test_n4_word_detected(self, validator):
        """N4 words should be detected as N4"""
        # 字 (じ, character) is N4
        level = validator.get_word_level("字")
        assert level == "N4"

    def test_n3_word_detected(self, validator):
        """N3 words should be detected as N3"""
        # 商人 (しょうにん, merchant) is N3
        level = validator.get_word_level("商人")
        assert level == "N3"

    def test_n2_word_detected(self, validator):
        """N2 words should be detected as N2"""
        # 銅 (どう, copper) is N2
        level = validator.get_word_level("銅")
        assert level == "N2"

    def test_n1_word_detected(self, validator):
        """N1 words should be detected as N1"""
        # 曖昧 (あいまい, ambiguous) is N1
        level = validator.get_word_level("曖昧")
        assert level == "N1"

    def test_unknown_word_returns_none(self, validator):
        """Words not in any JLPT list should return None"""
        # Made-up word
        level = validator.get_word_level("xyzabc123")
        assert level is None


class TestLearningValueCheck:
    """Test detection of stories with insufficient target-level vocabulary"""

    def test_enough_target_level_words_passes(self, validator):
        """Story with enough target-level words should pass learning value check"""
        # Create 500 tokens with enough N3 words
        # Threshold for N3 at 500 tokens: 5 + (500 // 60) = 13
        # Use actual N3 words from word list
        n3_words = [
            "環境",
            "影響",
            "議論",
            "共通",
            "権利",
            "結果",
            "現在",
            "現実",
            "交換",
            "効果",
            "構成",
            "行動",
            "不安",
            "不満",
            "世間",
            "世紀",
        ]  # 16 N3 words
        n5_words = ["私", "学校", "先生", "本", "車"] * 20  # 100 N5 words
        # Pad with particles to reach 500 tokens
        padding = ["は", "が", "を", "に", "で"] * 76  # 380 tokens (ignored)

        all_words = n3_words + n5_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N3")
        assert result.has_learning_value, (
            f"Should have learning value: {result.target_level_count}/{result.min_target_threshold}"
        )

    def test_not_enough_target_level_words_fails(self, validator):
        """Story with too few target-level words should fail learning value check"""
        # Create 500 tokens with only a few N3 words
        # Threshold for N3 at 500 tokens: 5 + (500 // 60) = 13
        n3_words = ["経験", "環境"]  # Only 2 N3 words
        n5_words = ["私", "学校", "先生", "本", "車"] * 20  # 100 N5 words
        padding = ["は", "が", "を", "に", "で"] * 80  # 400 tokens (ignored)

        all_words = n3_words + n5_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N3")
        assert not result.has_learning_value, (
            f"Should NOT have learning value: {result.target_level_count}/{result.min_target_threshold}"
        )


class TestTooHardCheck:
    """Test detection of stories that are too difficult"""

    def test_few_above_level_words_passes(self, validator):
        """Story with few above-level words should pass too-hard check"""
        # Create 500 tokens with few above-level words
        # Threshold for N3 at 500 tokens: 3 + (500 // 150) = 6
        n5_words = ["私", "学校", "先生"] * 20  # 60 N5 words
        n3_words = ["経験", "環境", "影響"] * 10  # 30 N3 words (target)
        n1_words = ["曖昧", "斡旋"]  # Only 2 N1 words (above level)
        padding = ["は", "が", "を", "に", "で"] * 80  # 400 tokens (ignored)

        all_words = n5_words + n3_words + n1_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N3")
        assert result.not_too_hard, (
            f"Should NOT be too hard: {result.above_level_count}/{result.max_above_threshold}"
        )

    def test_many_above_level_words_fails(self, validator):
        """Story with many above-level words should fail too-hard check"""
        # Create 500 tokens with many above-level words
        # Threshold for N3 at 500 tokens: 10 + (500 // 50) = 20
        n5_words = ["私", "学校", "先生"] * 20  # 60 N5 words
        n3_words = ["環境", "影響", "議論"] * 10  # 30 N3 words (target)
        # Need 21+ N1/N2 words to exceed threshold of 20
        n1_words = [
            "曖昧",
            "一切",
            "一同",
            "一変",
            "一律",
            "一括",
            "一気",
            "一連",
            "上位",
            "上司",
            "一息",
            "一敗",
            "一様",
            "一目",
            "一筋",
            "一見",
            "一面",
            "丁目",
            "万人",
            "万能",
            "上昇",
        ]  # 21 N1 words
        padding = ["は", "が", "を", "に", "で"] * 77  # 385 tokens (ignored)

        all_words = n5_words + n3_words + n1_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N3")
        assert not result.not_too_hard, (
            f"Should be too hard: {result.above_level_count}/{result.max_above_threshold}"
        )


class TestTooObscureCheck:
    """Test detection of stories with too many unknown words"""

    def test_few_unknown_words_passes(self, validator):
        """Story with few unknown words should pass too-obscure check"""
        # Threshold at 500 tokens: 3 + (500 // 250) = 5
        n5_words = ["私", "学校", "先生"] * 30  # 90 N5 words
        unknown_words = ["タケシ", "マリコ", "xyz"]  # 3 unknown (character names)
        padding = ["は", "が", "を", "に", "で"] * 80  # 400 tokens (ignored)

        all_words = n5_words + unknown_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N5")
        assert result.not_too_obscure, (
            f"Should NOT be too obscure: {result.unknown_count}/{result.max_unknown_threshold}"
        )

    def test_many_unknown_words_fails(self, validator):
        """Story with many unknown words should fail too-obscure check"""
        # Threshold at 500 tokens: 8 + (500 // 100) = 13
        n5_words = ["私", "学校", "先生"] * 30  # 90 N5 words
        # Need 14+ unknown words to exceed threshold
        unknown_words = [
            "xyz1",
            "xyz2",
            "xyz3",
            "xyz4",
            "xyz5",
            "xyz6",
            "xyz7",
            "xyz8",
            "xyz9",
            "xyz10",
            "xyz11",
            "xyz12",
            "xyz13",
            "xyz14",
            "xyz15",
        ]  # 15 unknown
        padding = ["は", "が", "を", "に", "で"] * 79  # 395 tokens (ignored)

        all_words = n5_words + unknown_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N5")
        assert not result.not_too_obscure, (
            f"Should be too obscure: {result.unknown_count}/{result.max_unknown_threshold}"
        )


class TestThresholdScaling:
    """Test that thresholds scale with story length"""

    def test_short_story_has_lower_thresholds(self, validator):
        """Short stories should have lower thresholds"""
        # 100 tokens
        tokens = make_tokens(["私"] * 100)
        result = validator.validate_tokens(tokens, "N3")

        # N3 thresholds at 100 tokens (relaxed):
        # min_target: 4 + (100 // 100) = 5
        # max_above: 10 + (100 // 50) = 12
        # max_unknown: 8 + (100 // 100) = 9
        assert result.min_target_threshold == 5
        assert result.max_above_threshold == 12
        assert result.max_unknown_threshold == 9

    def test_long_story_has_higher_thresholds(self, validator):
        """Long stories should have higher thresholds"""
        # 1000 tokens
        tokens = make_tokens(["私"] * 1000)
        result = validator.validate_tokens(tokens, "N3")

        # N3 thresholds at 1000 tokens (relaxed):
        # min_target: 4 + (1000 // 100) = 14
        # max_above: 10 + (1000 // 50) = 30
        # max_unknown: 8 + (1000 // 100) = 18
        assert result.min_target_threshold == 14
        assert result.max_above_threshold == 30
        assert result.max_unknown_threshold == 18

    def test_repetitive_story_still_needs_target_words(self, validator):
        """A long but repetitive story should still need enough target words"""
        # 2000 tokens but only 10 unique words (very repetitive)
        n5_words = ["私", "学校", "先生", "本", "車", "家", "男", "女", "子", "犬"]
        tokens = make_tokens(n5_words * 200)  # 2000 tokens, 10 unique

        result = validator.validate_tokens(tokens, "N3")

        # Threshold at 2000 tokens: 4 + (2000 // 100) = 24
        # But we have 0 N3 words (all are N5)
        assert result.min_target_threshold == 24
        assert result.target_level_count == 0
        assert not result.has_learning_value, "Repetitive N5 story should not pass N3 validation"


class TestN1NoLimit:
    """Test that N1 has no limit on above-level words"""

    def test_n1_has_no_above_level_limit(self, validator):
        """N1 should always pass the not_too_hard check"""
        # All words are "above" N1, which is impossible, but let's verify
        # the max_above_threshold is -1 (no limit)
        tokens = make_tokens(["曖昧"] * 100)
        result = validator.validate_tokens(tokens, "N1")

        assert result.max_above_threshold == -1
        assert result.not_too_hard is True


class TestParticlesAndCommonWords:
    """Test that particles and common words are properly ignored"""

    def test_particles_ignored(self, validator):
        """Particles should not be counted as unique words"""
        # All particles
        tokens = make_tokens(["は", "が", "を", "に", "で"] * 10)
        result = validator.validate_tokens(tokens, "N5")

        # Particles are ignored, so unique_words should be 0
        assert result.unique_words == 0

    def test_common_verbs_ignored(self, validator):
        """Common verbs like する, いる, ある should be ignored"""
        # Mix of ignored verbs and one real word
        tokens = make_tokens(["する", "いる", "ある", "私"])
        result = validator.validate_tokens(tokens, "N5")

        # Only 私 should be counted
        assert result.unique_words == 1

    def test_punctuation_ignored(self, validator):
        """Punctuation tokens should be ignored"""
        tokens = make_tokens(["私", "。", "、", "！", "？"])
        result = validator.validate_tokens(tokens, "N5")

        # Only 私 should be counted
        assert result.unique_words == 1


class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_empty_tokens_returns_neutral_result(self, validator):
        """Empty input should return neutral result without crashing"""
        result = validator.validate_tokens([], "N5")
        assert result.passed
        assert result.total_tokens == 0

    def test_invalid_level_returns_error(self, validator):
        """Invalid JLPT level should return error result"""
        tokens = [{"surface": "私", "baseForm": "私"}]
        result = validator.validate_tokens(tokens, "N6")  # Invalid level
        assert not result.passed
        assert "Invalid" in result.message

    def test_tokens_without_baseform_use_surface(self, validator):
        """Tokens without baseForm should fall back to surface"""
        tokens = [
            {"surface": "私"},  # No baseForm
            {"surface": "学校"},
        ]
        result = validator.validate_tokens(tokens, "N5")
        # Should still validate using surface
        assert result.unique_words >= 1

    def test_handles_token_objects(self, validator):
        """Should handle Token objects (not just dicts)"""

        class MockToken:
            def __init__(self, surface, base_form):
                self.surface = surface
                self.baseForm = base_form

        tokens = [
            MockToken("私", "私"),
            MockToken("学校", "学校"),
        ]
        result = validator.validate_tokens(tokens, "N5")
        assert result.unique_words >= 1


class TestValidationResult:
    """Test the ValidationResult structure"""

    def test_result_contains_all_fields(self, validator):
        """Validation result should contain all required fields"""
        tokens = [{"surface": "私", "baseForm": "私"}]
        result = validator.validate_tokens(tokens, "N5")

        # New fields
        assert hasattr(result, "total_tokens")
        assert hasattr(result, "unique_words")
        assert hasattr(result, "words_by_level")
        assert hasattr(result, "target_level_count")
        assert hasattr(result, "above_level_count")
        assert hasattr(result, "unknown_count")
        assert hasattr(result, "min_target_threshold")
        assert hasattr(result, "max_above_threshold")
        assert hasattr(result, "max_unknown_threshold")
        assert hasattr(result, "has_learning_value")
        assert hasattr(result, "not_too_hard")
        assert hasattr(result, "not_too_obscure")
        assert hasattr(result, "passed")
        assert hasattr(result, "readability_score")
        assert hasattr(result, "target_level")
        assert hasattr(result, "message")
        assert hasattr(result, "target_level_words")
        assert hasattr(result, "above_level_words")
        assert hasattr(result, "unknown_words")

    def test_to_dict_conversion(self, validator):
        """to_dict should convert result to JSON-serializable dict"""
        tokens = [{"surface": "私", "baseForm": "私"}]
        result = validator.validate_tokens(tokens, "N5")
        result_dict = validator.to_dict(result)

        assert isinstance(result_dict, dict)
        assert "totalTokens" in result_dict
        assert "uniqueWords" in result_dict
        assert "targetLevelCount" in result_dict
        assert "hasLearningValue" in result_dict
        assert "passed" in result_dict


class TestRealWorldScenarios:
    """Test with realistic story scenarios from the plan"""

    def test_good_n3_story_passes(self, validator):
        """N3 story with good learning value should pass"""
        # From plan: 500 tokens, need 13+ N3 words, max 6 above, max 5 unknown
        n5_words = ["私", "学校", "先生", "本", "車", "家", "人", "男", "女", "子"] * 4  # 40 N5
        # Use actual N3 words from the word list
        n3_words = [
            "環境",
            "影響",
            "議論",
            "共通",
            "権利",
            "結果",
            "現在",
            "現実",
            "交換",
            "効果",
            "構成",
            "行動",
            "不安",
            "不満",
            "世間",
            "世紀",
            "上京",
            "上達",
            "不幸",
            "一致",
            "一般",
            "一瞬",
            "一種",
        ]  # 23 N3 words
        n2_words = ["銅", "統一", "投資"]  # 3 N2 (above level)
        padding = ["は", "が", "を", "に", "で"] * 86  # 430 tokens (ignored)

        all_words = n5_words + n3_words + n2_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N3")

        # Should pass all checks
        assert result.has_learning_value, (
            f"Need learning value: {result.target_level_count}/{result.min_target_threshold}"
        )
        assert result.not_too_hard, (
            f"Should not be too hard: {result.above_level_count}/{result.max_above_threshold}"
        )
        assert result.not_too_obscure, (
            f"Should not be too obscure: {result.unknown_count}/{result.max_unknown_threshold}"
        )
        assert result.passed, f"Should pass overall: {result.message}"

    def test_too_easy_n3_story_fails(self, validator):
        """N3 story with only N5 vocabulary should fail"""
        # All N5 words - no N3 learning value
        n5_words = [
            "私",
            "学校",
            "先生",
            "本",
            "車",
            "家",
            "人",
            "男",
            "女",
            "子",
            "友達",
            "子供",
            "父",
            "母",
            "兄",
            "姉",
            "弟",
            "妹",
            "犬",
            "猫",
        ]
        tokens = make_tokens(n5_words * 25)  # 500 tokens

        result = validator.validate_tokens(tokens, "N3")

        # Should fail learning value check (no N3 words)
        assert result.target_level_count == 0
        assert not result.has_learning_value
        assert not result.passed

    def test_too_hard_n5_story_fails(self, validator):
        """N5 story with too many above-level words should fail"""
        # Mix of N5 and too many N4/N3/N2/N1 words
        # Threshold for N5 at 500 tokens: 5 + (500 // 100) = 10
        n5_words = ["私", "学校", "先生", "本", "車"] * 20  # 100 N5 words
        # Need 11+ N4+ words to exceed threshold (use actual N4 words)
        above_words = [
            "経験",
            "規則",
            "原因",
            "国際",
            "字",
            "届ける",
            "準備",
            "予定",
            "連絡",
            "説明",
            "普通",
        ]  # 11 N4 words
        padding = ["は", "が", "を", "に", "で"] * 77  # 385 tokens (ignored)

        all_words = n5_words + above_words + padding
        tokens = make_tokens(all_words)

        result = validator.validate_tokens(tokens, "N5")

        # Should fail too-hard check
        assert result.above_level_count > result.max_above_threshold
        assert not result.not_too_hard
        assert not result.passed

    def test_words_by_level_tracked_correctly(self, validator):
        """Words should be correctly categorized by level"""
        # Use words that are actually at the expected levels
        tokens = make_tokens(
            [
                "私",  # N5
                "経験",  # N4 (not N3 as I thought!)
                "環境",  # N3
                "銅",  # N2
                "曖昧",  # N1
                "xyzabc",  # Unknown
            ]
        )

        result = validator.validate_tokens(tokens, "N3")

        # Check words_by_level
        assert result.words_by_level.get("N5", 0) == 1
        assert result.words_by_level.get("N4", 0) == 1
        assert result.words_by_level.get("N3", 0) == 1
        assert result.words_by_level.get("N2", 0) == 1
        assert result.words_by_level.get("N1", 0) == 1
        assert result.words_by_level.get("unknown", 0) == 1

        # Check categorization for N3 target
        assert result.target_level_count == 1  # N3 words (環境)
        assert result.above_level_count == 2  # N2 + N1 words
        assert result.unknown_count == 1  # xyzabc
