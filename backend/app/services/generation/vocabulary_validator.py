"""
JLPT Vocabulary Validator - Learning Value Score Algorithm

Validates that generated stories match the target JLPT difficulty level.
Uses count-based thresholds that scale with story length (total tokens).

Key insight: A good graded reader should:
1. Be readable - mostly familiar vocabulary (comprehensible input)
2. Provide learning value - enough target-level words to learn from
3. Not be frustrating - few words above the learner's level
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Regex to detect katakana words (loanwords)
KATAKANA_PATTERN = re.compile(r"^[ァ-ヶー]+$")

# JLPT levels in order from easiest to hardest
JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"]

# Minimum unique words AT target level (base, scaling_factor)
# Formula: min_target = base + (total_tokens // scaling_factor)
# Relaxed thresholds to account for natural vocabulary variation
MIN_TARGET_WORDS = {
    "N5": (2, 150),  # 500 tokens → 5, 1000 tokens → 8
    "N4": (3, 120),  # 500 tokens → 7, 1000 tokens → 11
    "N3": (4, 100),  # 500 tokens → 9, 1000 tokens → 14
    "N2": (5, 80),  # 500 tokens → 11, 1000 tokens → 17
    "N1": (6, 80),  # 500 tokens → 12, 1000 tokens → 18
}

# Maximum unique words ABOVE target level (base, scaling_factor)
# Formula: max_above = base + (total_tokens // scaling_factor)
# Relaxed to allow more natural vocabulary mixing
MAX_ABOVE_WORDS = {
    "N5": (5, 100),  # 500 tokens → 10, 1000 tokens → 15
    "N4": (10, 50),  # 500 tokens → 20, 1000 tokens → 30 (relaxed for N4)
    "N3": (10, 50),  # 500 tokens → 20, 1000 tokens → 30
    "N2": (10, 50),  # 500 tokens → 20, 1000 tokens → 30
    "N1": None,  # N1 has no limit (highest level)
}

# Maximum unknown words: 8 + (total_tokens // 100)
# Relaxed to allow character names, place names, compound words, and unlisted vocabulary
UNKNOWN_WORDS_BASE = 8
UNKNOWN_WORDS_SCALE = 100

# Particles and common words that should be ignored in validation
# These appear at all levels and shouldn't count against the score
IGNORED_WORDS = {
    # Particles
    "は",
    "が",
    "を",
    "に",
    "で",
    "と",
    "も",
    "の",
    "へ",
    "から",
    "まで",
    "より",
    "や",
    "か",
    "ね",
    "よ",
    "な",
    "わ",
    "さ",
    "ぞ",
    "ぜ",
    "け",
    "こそ",
    "だけ",
    "しか",
    "ばかり",
    # Common punctuation-like words
    "。",
    "、",
    "！",
    "？",
    "「",
    "」",
    "『",
    "』",
    "…",
    "ー",
    "・",
    # Numbers
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
    "百",
    "千",
    "万",
    # Very basic words that appear everywhere
    "する",
    "いる",
    "ある",
    "なる",
    "できる",
    "くる",
    "いく",
    "みる",
    "くれる",
    "もらう",
    "この",
    "その",
    "あの",
    "どの",
    "これ",
    "それ",
    "あれ",
    "どれ",
    "ここ",
    "そこ",
    "あそこ",
    "どこ",
    "こう",
    "そう",
    "ああ",
    "どう",
    # Auxiliary verbs and grammatical endings (not vocabulary)
    "です",
    "ます",
    "た",
    "て",
    "ない",
    "ば",
    "う",
    "よう",
    "だ",
    "だろう",
    "でしょう",
    "れる",
    "られる",
    "せる",
    "させる",
    "たい",
    "ほしい",
    "ぬ",
    "ん",
    "ている",
    "てある",
    "ておく",
    "てしまう",
    "ていく",
    "てくる",
    "しまう",
    "し",
    "ながら",
    "たり",
    "つつ",  # Conjunctive forms
    # Common grammatical patterns
    "ので",
    "のに",
    "のは",
    "のが",
    "のを",
    "について",
    "として",
    "によって",
    "において",
    "という",
    "ということ",
    "というのは",
    # Basic adverbs and expressions (fundamental grammar)
    "とても",
    "すごく",
    "本当に",
    "もう",
    "まだ",
    "もっと",
    "ちょっと",
    "すぐ",
    "ずっと",
    "たくさん",
    "少し",
    "全然",
    "絶対",
    "きっと",
    "たぶん",
    "やっぱり",
    "やはり",
    # Basic conjunctions
    "そして",
    "でも",
    "しかし",
    "だから",
    "けれど",
    "けど",
    "または",
    "あるいは",
    # Fundamental time/counter words used at all levels
    "時",
    "日",
    "年",
    "月",
    "週",
    "分",
    "秒",
    "回",
    "度",
    "番",
    "目",
    "時間",
    "今日",
    "明日",
    "昨日",
    "毎日",
    "毎週",
    "毎月",
    "毎年",
    # Common words that appear in all levels regardless of official JLPT classification
    "人",
    "物",
    "事",
    "所",
    "方",
    "前",
    "後",
    "中",
    "上",
    "下",
    "外",
    "内",
    "ぐらい",
    "くらい",
    "ころ",
    "頃",
    "ため",
    "まま",
    "ほう",
}


@dataclass
class ValidationResult:
    """Result of vocabulary validation using Learning Value Score"""

    # Story metrics
    total_tokens: int  # Total token count (for threshold scaling)
    unique_words: int  # Unique word count
    words_by_level: dict[str, int]  # {"N5": 40, "N4": 30, ..., "unknown": 5}

    # Unique counts (what we test against thresholds)
    target_level_count: int  # Unique words AT target level
    above_level_count: int  # Unique words ABOVE target level
    unknown_count: int  # Unique words not in any JLPT list

    # Calculated thresholds (for transparency)
    min_target_threshold: int
    max_above_threshold: int  # -1 means no limit (N1)
    max_unknown_threshold: int

    # Pass/fail checks
    has_learning_value: bool  # target_level_count >= min_target_threshold
    not_too_hard: bool  # above_level_count <= max_above_threshold
    not_too_obscure: bool  # unknown_count <= max_unknown_threshold
    passed: bool  # All three checks pass

    # Informational
    readability_score: float  # % of tokens at or below target level
    target_level: str
    message: str

    # Detailed word lists for debugging/display
    target_level_words: list[str] = field(default_factory=list)
    above_level_words: list[str] = field(default_factory=list)
    unknown_words: list[str] = field(default_factory=list)


class VocabularyValidator:
    """
    Validates vocabulary against JLPT word lists using Learning Value Score.

    Word lists are cumulative:
    - N5 list contains only N5 words
    - N4 list contains N4 + N5 words
    - N3 list contains N3 + N4 + N5 words
    - etc.
    """

    def __init__(self):
        self._word_lists: dict[str, set[str]] = {}  # Cumulative lists
        self._level_specific: dict[str, set[str]] = {}  # Non-cumulative, level-specific words
        self._load_word_lists()

    def _load_word_lists(self):
        """Load JLPT word lists from files and build cumulative sets"""
        data_dir = Path(__file__).parent.parent.parent / "data" / "jlpt"

        if not data_dir.exists():
            logger.warning(f"JLPT data directory not found: {data_dir}")
            return

        # Load each level's specific words
        for level in JLPT_LEVELS:
            filename = data_dir / f"{level.lower()}.txt"
            if filename.exists():
                with open(filename, encoding="utf-8") as f:
                    words = {line.strip() for line in f if line.strip()}
                self._level_specific[level] = words
                logger.info(f"Loaded {len(words)} words for {level}")
            else:
                logger.warning(f"Word list not found: {filename}")
                self._level_specific[level] = set()

        # Build cumulative word lists (N5 is base, each level adds previous)
        cumulative = set()
        for level in JLPT_LEVELS:
            cumulative = cumulative | self._level_specific.get(level, set())
            self._word_lists[level] = cumulative.copy()
            logger.info(f"Cumulative {level}: {len(self._word_lists[level])} words")

    def get_word_level(self, word: str) -> str | None:
        """
        Get the JLPT level of a word.
        Returns the easiest level where this word appears, or None if not in any list.
        """
        for level in JLPT_LEVELS:
            if word in self._level_specific.get(level, set()):
                return level
        return None

    def validate_tokens(self, tokens: list[dict], target_level: str) -> ValidationResult:
        """
        Validate a list of tokens against a target JLPT level.

        Args:
            tokens: List of Token objects (dicts with 'surface', 'baseForm', 'partOfSpeech')
            target_level: Target JLPT level (N5, N4, N3, N2, N1)

        Returns:
            ValidationResult with scores and word lists
        """
        if target_level not in JLPT_LEVELS:
            return ValidationResult(
                total_tokens=0,
                unique_words=0,
                words_by_level={},
                target_level_count=0,
                above_level_count=0,
                unknown_count=0,
                min_target_threshold=0,
                max_above_threshold=0,
                max_unknown_threshold=0,
                has_learning_value=False,
                not_too_hard=False,
                not_too_obscure=False,
                passed=False,
                readability_score=0.0,
                target_level=target_level,
                message=f"Invalid JLPT level: {target_level}",
            )

        if not self._word_lists:
            logger.warning("Word lists not loaded - skipping validation")
            return ValidationResult(
                total_tokens=0,
                unique_words=0,
                words_by_level={},
                target_level_count=0,
                above_level_count=0,
                unknown_count=0,
                min_target_threshold=0,
                max_above_threshold=0,
                max_unknown_threshold=0,
                has_learning_value=True,
                not_too_hard=True,
                not_too_obscure=True,
                passed=True,
                readability_score=1.0,
                target_level=target_level,
                message="Validation skipped - word lists not loaded",
            )

        target_level_idx = JLPT_LEVELS.index(target_level)

        # Count total tokens (for threshold scaling)
        total_tokens = len(tokens)

        # Extract unique words to check (use baseForm when available, fallback to surface)
        words_to_check = set()
        for token in tokens:
            if isinstance(token, dict):
                word = token.get("baseForm") or token.get("surface", "")
            else:
                # Handle Token objects
                word = getattr(token, "baseForm", None) or getattr(token, "surface", "")

            if word and word not in IGNORED_WORDS:
                words_to_check.add(word)

        if not words_to_check:
            return ValidationResult(
                total_tokens=total_tokens,
                unique_words=0,
                words_by_level={},
                target_level_count=0,
                above_level_count=0,
                unknown_count=0,
                min_target_threshold=0,
                max_above_threshold=0,
                max_unknown_threshold=0,
                has_learning_value=True,
                not_too_hard=True,
                not_too_obscure=True,
                passed=True,
                readability_score=1.0,
                target_level=target_level,
                message="No words to validate",
            )

        # Categorize words by level
        words_by_level: dict[str, list[str]] = {level: [] for level in JLPT_LEVELS}
        words_by_level["unknown"] = []
        words_by_level["katakana"] = []  # Track katakana separately

        target_level_words = []
        above_level_words = []
        below_level_words = []  # At or below target, but not at target
        unknown_words = []

        for word in words_to_check:
            # Check if word is katakana (loanword) - don't count against above-level
            is_katakana = bool(KATAKANA_PATTERN.match(word))

            word_level = self.get_word_level(word)

            if word_level is None:
                # Word not in any JLPT list
                if is_katakana:
                    words_by_level["katakana"].append(word)
                    # Don't count katakana as unknown - they're common loanwords
                else:
                    words_by_level["unknown"].append(word)
                    unknown_words.append(word)
            else:
                words_by_level[word_level].append(word)
                word_level_idx = JLPT_LEVELS.index(word_level)

                if word_level_idx == target_level_idx:
                    # Word is AT target level
                    target_level_words.append(word)
                elif word_level_idx < target_level_idx:
                    # Word is BELOW target level (easier)
                    below_level_words.append(word)
                else:
                    # Word is ABOVE target level (harder)
                    # Skip katakana words - loanwords are common at all levels
                    if not is_katakana:
                        above_level_words.append(word)

        # Convert to counts for output
        words_by_level_counts = {level: len(words) for level, words in words_by_level.items()}

        # Calculate thresholds based on TOTAL TOKENS (story length)
        base, scale = MIN_TARGET_WORDS[target_level]
        min_target_threshold = base + (total_tokens // scale)

        if MAX_ABOVE_WORDS[target_level] is not None:
            base, scale = MAX_ABOVE_WORDS[target_level]
            max_above_threshold = base + (total_tokens // scale)
        else:
            max_above_threshold = -1  # No limit for N1

        max_unknown_threshold = UNKNOWN_WORDS_BASE + (total_tokens // UNKNOWN_WORDS_SCALE)

        # Calculate unique counts (what we compare against thresholds)
        target_level_count = len(target_level_words)
        above_level_count = len(above_level_words)
        unknown_count = len(unknown_words)
        unique_words = len(words_to_check)

        # Run validation checks
        has_learning_value = target_level_count >= min_target_threshold

        if max_above_threshold == -1:
            not_too_hard = True  # N1 has no limit
        else:
            not_too_hard = above_level_count <= max_above_threshold

        not_too_obscure = unknown_count <= max_unknown_threshold

        passed = has_learning_value and not_too_hard and not_too_obscure

        # Calculate readability score (informational)
        # % of tokens at or below target level
        readable_count = len(target_level_words) + len(below_level_words)
        readability_score = readable_count / unique_words if unique_words > 0 else 1.0

        # Generate message
        if passed:
            message = f"Story vocabulary is appropriate for {target_level}"
        else:
            issues = []
            if not has_learning_value:
                issues.append(
                    f"not enough {target_level} words ({target_level_count}/{min_target_threshold})"
                )
            if not not_too_hard:
                issues.append(
                    f"too many above-level words ({above_level_count}/{max_above_threshold})"
                )
            if not not_too_obscure:
                issues.append(f"too many unknown words ({unknown_count}/{max_unknown_threshold})")
            message = f"Story failed {target_level} validation: {', '.join(issues)}"

        return ValidationResult(
            total_tokens=total_tokens,
            unique_words=unique_words,
            words_by_level=words_by_level_counts,
            target_level_count=target_level_count,
            above_level_count=above_level_count,
            unknown_count=unknown_count,
            min_target_threshold=min_target_threshold,
            max_above_threshold=max_above_threshold,
            max_unknown_threshold=max_unknown_threshold,
            has_learning_value=has_learning_value,
            not_too_hard=not_too_hard,
            not_too_obscure=not_too_obscure,
            passed=passed,
            readability_score=readability_score,
            target_level=target_level,
            message=message,
            target_level_words=target_level_words[:20],  # Limit to 20 examples
            above_level_words=above_level_words[:20],
            unknown_words=unknown_words[:20],
        )

    def to_dict(self, result: ValidationResult) -> dict:
        """Convert ValidationResult to a dictionary for JSON serialization"""
        return {
            "totalTokens": result.total_tokens,
            "uniqueWords": result.unique_words,
            "wordsByLevel": result.words_by_level,
            "targetLevelCount": result.target_level_count,
            "aboveLevelCount": result.above_level_count,
            "unknownCount": result.unknown_count,
            "minTargetThreshold": result.min_target_threshold,
            "maxAboveThreshold": result.max_above_threshold,
            "maxUnknownThreshold": result.max_unknown_threshold,
            "hasLearningValue": result.has_learning_value,
            "notTooHard": result.not_too_hard,
            "notTooObscure": result.not_too_obscure,
            "passed": result.passed,
            "readabilityScore": round(result.readability_score, 3),
            "targetLevel": result.target_level,
            "message": result.message,
            "targetLevelWords": result.target_level_words,
            "aboveLevelWords": result.above_level_words,
            "unknownWords": result.unknown_words,
        }


# Singleton instance
_validator: VocabularyValidator | None = None


def get_validator() -> VocabularyValidator:
    """Get or create the vocabulary validator singleton"""
    global _validator
    if _validator is None:
        _validator = VocabularyValidator()
    return _validator
