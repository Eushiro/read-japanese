"""Japanese tokenization service using fugashi with IPADIC dictionary"""
from typing import List, Optional
import fugashi
import ipadic
from app.models.story import Token, TokenPart


# Katakana compounds that should be kept together
# These are common loanwords that may be incorrectly split
KATAKANA_COMPOUNDS = {
    ("スマート", "フォン"): "スマートフォン",
    ("アイス", "クリーム"): "アイスクリーム",
    ("クレジット", "カード"): "クレジットカード",
    ("ショッピング", "センター"): "ショッピングセンター",
    ("コンピュータ", "ー"): "コンピューター",
    ("エア", "コン"): "エアコン",
    ("リモート", "コントロール"): "リモートコントロール",
    ("ソフト", "ウェア"): "ソフトウェア",
    ("ハード", "ウェア"): "ハードウェア",
}


class TokenizerService:
    """Service for tokenizing Japanese text using fugashi with IPADIC"""

    def __init__(self):
        # Use fugashi with IPADIC dictionary
        self.tagger = fugashi.GenericTagger(ipadic.MECAB_ARGS)

    @property
    def is_available(self) -> bool:
        """Check if tokenization is available"""
        return self.tagger is not None

    def tokenize_text(self, text: str) -> List[Token]:
        """
        Tokenize Japanese text into tokens with readings and parts of speech.
        """
        tokens = []

        for word in self.tagger(text):
            surface = word.surface

            # IPADIC feature tuple: (pos1, pos2, pos3, pos4, conjugation1, conjugation2, base_form, reading, pronunciation)
            feature = word.feature

            # Extract reading (index 7 in IPADIC)
            reading_katakana = feature[7] if len(feature) > 7 and feature[7] != '*' else None

            if reading_katakana:
                reading_hiragana = self._katakana_to_hiragana(reading_katakana)
            else:
                reading_hiragana = None

            # Extract part of speech (index 0)
            pos = self._get_part_of_speech(feature[0] if feature else "")

            # Extract base form (index 6)
            base_form = feature[6] if len(feature) > 6 and feature[6] != '*' else surface

            # Create token parts with readings for kanji
            parts = self._create_token_parts(surface, reading_hiragana)

            token = Token(
                surface=surface,
                parts=parts,
                baseForm=base_form,
                partOfSpeech=pos
            )
            tokens.append(token)

        # Post-process to merge katakana compounds
        tokens = self._merge_katakana_compounds(tokens)

        return tokens

    def _merge_katakana_compounds(self, tokens: List[Token]) -> List[Token]:
        """Merge consecutive tokens that form known katakana compounds."""
        if len(tokens) < 2:
            return tokens

        result = []
        i = 0

        while i < len(tokens):
            merged = False

            # Check if current and next token form a compound
            if i + 1 < len(tokens):
                pair = (tokens[i].surface, tokens[i + 1].surface)
                if pair in KATAKANA_COMPOUNDS:
                    merged_surface = KATAKANA_COMPOUNDS[pair]
                    merged_token = Token(
                        surface=merged_surface,
                        parts=[TokenPart(text=merged_surface)],
                        baseForm=merged_surface,
                        partOfSpeech=tokens[i].partOfSpeech
                    )
                    result.append(merged_token)
                    i += 2
                    merged = True

            if not merged:
                result.append(tokens[i])
                i += 1

        return result

    def _get_part_of_speech(self, pos: str) -> str:
        """Convert IPADIC POS to simplified category"""
        if not pos:
            return "unknown"

        pos_mapping = {
            "名詞": "noun",
            "動詞": "verb",
            "形容詞": "adjective",
            "形状詞": "adjective",
            "副詞": "adverb",
            "助詞": "particle",
            "助動詞": "auxiliary",
            "接続詞": "conjunction",
            "感動詞": "interjection",
            "連体詞": "adnominal",
            "代名詞": "pronoun",
            "接頭辞": "prefix",
            "接尾辞": "suffix",
            "記号": "punctuation",
            "補助記号": "punctuation",
            "空白": "whitespace",
        }

        return pos_mapping.get(pos, pos.lower() if pos else "unknown")

    def _create_token_parts(self, surface: str, reading: str) -> Optional[List[TokenPart]]:
        """
        Create token parts with readings for kanji characters.
        """
        if not surface:
            return None

        # Check if surface contains kanji
        has_kanji = any(self._is_kanji(c) for c in surface)

        if not has_kanji:
            # No kanji, just return the text without reading
            return [TokenPart(text=surface)]

        # Check if all characters are kanji
        all_kanji = all(self._is_kanji(c) for c in surface)

        if all_kanji and reading:
            # All kanji compound (e.g., 今日, 友達) - keep as single unit
            return [TokenPart(text=surface, reading=reading)]
        elif reading:
            # Mixed kanji and kana - need to align reading properly
            return self._align_reading_to_kanji(surface, reading)
        else:
            return [TokenPart(text=surface)]

    def _align_reading_to_kanji(self, surface: str, reading: str) -> List[TokenPart]:
        """
        Align reading to kanji parts only, leaving kana parts without reading.

        For example:
        - 食べ with reading たべ -> [食(た), べ]
        - 言い with reading いい -> [言(い), い]
        """
        parts = []

        # Find the trailing kana portion of surface (if any)
        surface_kana_suffix = ""
        for i in range(len(surface) - 1, -1, -1):
            if self._is_kanji(surface[i]):
                break
            surface_kana_suffix = surface[i] + surface_kana_suffix

        # Find leading kana portion (if any)
        surface_kana_prefix = ""
        for i in range(len(surface)):
            if self._is_kanji(surface[i]):
                break
            surface_kana_prefix += surface[i]

        # Convert surface kana to hiragana for matching
        suffix_hira = self._katakana_to_hiragana(surface_kana_suffix)
        prefix_hira = self._katakana_to_hiragana(surface_kana_prefix)

        # The reading should end with suffix_hira and start with prefix_hira
        # Extract the kanji reading from the middle

        reading_start = len(prefix_hira)
        reading_end = len(reading) - len(suffix_hira) if suffix_hira else len(reading)

        # Build parts
        surface_idx = 0

        # Add prefix kana if any
        if surface_kana_prefix:
            parts.append(TokenPart(text=surface_kana_prefix))
            surface_idx = len(surface_kana_prefix)

        # Find and add kanji portions with their readings
        kanji_reading_idx = reading_start

        while surface_idx < len(surface) - len(surface_kana_suffix):
            char = surface[surface_idx]

            if self._is_kanji(char):
                # Find extent of consecutive kanji
                kanji_start = surface_idx
                while surface_idx < len(surface) - len(surface_kana_suffix) and self._is_kanji(surface[surface_idx]):
                    surface_idx += 1
                kanji_text = surface[kanji_start:surface_idx]

                # Check if there's kana between kanji groups
                if surface_idx < len(surface) - len(surface_kana_suffix):
                    # There's more content - find the middle kana
                    mid_kana_start = surface_idx
                    while surface_idx < len(surface) - len(surface_kana_suffix) and not self._is_kanji(surface[surface_idx]):
                        surface_idx += 1
                    mid_kana = surface[mid_kana_start:surface_idx]
                    mid_kana_hira = self._katakana_to_hiragana(mid_kana)

                    # Find this kana in the reading
                    kana_pos = reading.find(mid_kana_hira, kanji_reading_idx)
                    if kana_pos > kanji_reading_idx:
                        kanji_reading = reading[kanji_reading_idx:kana_pos]
                        kanji_reading_idx = kana_pos + len(mid_kana_hira)
                    else:
                        kanji_reading = reading[kanji_reading_idx:reading_end]
                        kanji_reading_idx = reading_end

                    parts.append(TokenPart(text=kanji_text, reading=kanji_reading))
                    parts.append(TokenPart(text=mid_kana))
                else:
                    # This is the last kanji group before suffix
                    kanji_reading = reading[kanji_reading_idx:reading_end]
                    parts.append(TokenPart(text=kanji_text, reading=kanji_reading))
            else:
                surface_idx += 1

        # Add suffix kana if any
        if surface_kana_suffix:
            parts.append(TokenPart(text=surface_kana_suffix))

        return parts

    def _is_kanji(self, char: str) -> bool:
        """Check if character is a kanji"""
        code = ord(char)
        return 0x4E00 <= code <= 0x9FFF

    def _katakana_to_hiragana(self, text: str) -> str:
        """Convert katakana to hiragana"""
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


# Global instance
_tokenizer_service: Optional[TokenizerService] = None


def get_tokenizer_service() -> TokenizerService:
    """Get or create the tokenizer service instance"""
    global _tokenizer_service
    if _tokenizer_service is None:
        _tokenizer_service = TokenizerService()
    return _tokenizer_service
