import Foundation

/// Extension to convert romaji to hiragana for Japanese text search
extension String {
    /// Converts romaji text to hiragana for search matching
    /// Supports standard Hepburn romanization
    func romajiToHiragana() -> String {
        var result = ""
        var input = self.lowercased()

        // Romaji to hiragana mapping (longest patterns first for proper matching)
        let romajiMap: [(romaji: String, hiragana: String)] = [
            // Special combinations
            ("sha", "しゃ"), ("shi", "し"), ("shu", "しゅ"), ("sho", "しょ"),
            ("cha", "ちゃ"), ("chi", "ち"), ("chu", "ちゅ"), ("cho", "ちょ"),
            ("tsu", "つ"),
            ("ja", "じゃ"), ("ji", "じ"), ("ju", "じゅ"), ("jo", "じょ"),

            // Y-combinations
            ("kya", "きゃ"), ("kyu", "きゅ"), ("kyo", "きょ"),
            ("gya", "ぎゃ"), ("gyu", "ぎゅ"), ("gyo", "ぎょ"),
            ("nya", "にゃ"), ("nyu", "にゅ"), ("nyo", "にょ"),
            ("hya", "ひゃ"), ("hyu", "ひゅ"), ("hyo", "ひょ"),
            ("bya", "びゃ"), ("byu", "びゅ"), ("byo", "びょ"),
            ("pya", "ぴゃ"), ("pyu", "ぴゅ"), ("pyo", "ぴょ"),
            ("mya", "みゃ"), ("myu", "みゅ"), ("myo", "みょ"),
            ("rya", "りゃ"), ("ryu", "りゅ"), ("ryo", "りょ"),

            // Double consonants (small tsu)
            ("kk", "っk"), ("ss", "っs"), ("tt", "っt"), ("pp", "っp"),
            ("cc", "っc"), ("mm", "っm"), ("nn", "ん"), ("nb", "んb"), ("mp", "んp"),

            // Basic syllables
            ("ka", "か"), ("ki", "き"), ("ku", "く"), ("ke", "け"), ("ko", "こ"),
            ("ga", "が"), ("gi", "ぎ"), ("gu", "ぐ"), ("ge", "げ"), ("go", "ご"),
            ("sa", "さ"), ("si", "し"), ("su", "す"), ("se", "せ"), ("so", "そ"),
            ("za", "ざ"), ("zi", "じ"), ("zu", "ず"), ("ze", "ぜ"), ("zo", "ぞ"),
            ("ta", "た"), ("ti", "ち"), ("tu", "つ"), ("te", "て"), ("to", "と"),
            ("da", "だ"), ("di", "ぢ"), ("du", "づ"), ("de", "で"), ("do", "ど"),
            ("na", "な"), ("ni", "に"), ("nu", "ぬ"), ("ne", "ね"), ("no", "の"),
            ("ha", "は"), ("hi", "ひ"), ("hu", "ふ"), ("fu", "ふ"), ("he", "へ"), ("ho", "ほ"),
            ("ba", "ば"), ("bi", "び"), ("bu", "ぶ"), ("be", "べ"), ("bo", "ぼ"),
            ("pa", "ぱ"), ("pi", "ぴ"), ("pu", "ぷ"), ("pe", "ぺ"), ("po", "ぽ"),
            ("ma", "ま"), ("mi", "み"), ("mu", "む"), ("me", "め"), ("mo", "も"),
            ("ya", "や"), ("yu", "ゆ"), ("yo", "よ"),
            ("ra", "ら"), ("ri", "り"), ("ru", "る"), ("re", "れ"), ("ro", "ろ"),
            ("wa", "わ"), ("wo", "を"),

            // Vowels
            ("a", "あ"), ("i", "い"), ("u", "う"), ("e", "え"), ("o", "お"),

            // N at end or before non-vowel
            ("n", "ん")
        ]

        while !input.isEmpty {
            var matched = false

            for (romaji, hiragana) in romajiMap {
                if input.hasPrefix(romaji) {
                    result += hiragana
                    input.removeFirst(romaji.count)
                    matched = true
                    break
                }
            }

            if !matched {
                // Keep non-matching characters as-is
                result.append(input.removeFirst())
            }
        }

        // Clean up any remaining romaji letters after double consonant markers
        return result.replacingOccurrences(of: "っk", with: "っ")
            .replacingOccurrences(of: "っs", with: "っ")
            .replacingOccurrences(of: "っt", with: "っ")
            .replacingOccurrences(of: "っp", with: "っ")
            .replacingOccurrences(of: "っc", with: "っ")
            .replacingOccurrences(of: "っm", with: "っ")
            .replacingOccurrences(of: "んb", with: "ん")
            .replacingOccurrences(of: "んp", with: "ん")
    }

    /// Check if string contains only ASCII letters (potential romaji)
    var isLikelyRomaji: Bool {
        !self.isEmpty && self.allSatisfy { $0.isASCII && ($0.isLetter || $0.isWhitespace) }
    }

    /// Search helper that matches against hiragana using romaji conversion if needed
    func matchesJapaneseSearch(_ query: String) -> Bool {
        let lowercaseSelf = self.lowercased()
        let lowercaseQuery = query.lowercased()

        // Direct contains check
        if lowercaseSelf.contains(lowercaseQuery) || self.contains(query) {
            return true
        }

        // If query looks like romaji, convert and check
        if query.isLikelyRomaji {
            let hiraganaQuery = query.romajiToHiragana()
            if self.contains(hiraganaQuery) {
                return true
            }

            // Also try matching against katakana version
            let katakanaQuery = hiraganaQuery.hiraganaToKatakana()
            if self.contains(katakanaQuery) {
                return true
            }
        }

        return false
    }

    /// Convert hiragana to katakana
    func hiraganaToKatakana() -> String {
        var result = ""
        for char in self {
            if let scalar = char.unicodeScalars.first,
               scalar.value >= 0x3041 && scalar.value <= 0x3096 {
                // Hiragana range - convert to katakana
                let katakana = Character(UnicodeScalar(scalar.value + 0x60)!)
                result.append(katakana)
            } else {
                result.append(char)
            }
        }
        return result
    }
}
