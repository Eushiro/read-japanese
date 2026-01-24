import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isRomaji, toHiragana, toKatakana } from "wanakana";

import { Input } from "@/components/ui/input";

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: SearchSuggestion[];
  onSelect?: (suggestion: SearchSuggestion) => void;
  showSuggestions?: boolean;
  className?: string;
}

/**
 * Convert search term to include hiragana/katakana variants for Japanese search
 */
export function getSearchVariants(term: string): {
  original: string;
  hiragana: string;
  katakana: string;
} {
  const normalized = term.toLowerCase().trim();
  return {
    original: normalized,
    hiragana: isRomaji(normalized) ? toHiragana(normalized) : normalized,
    katakana: isRomaji(normalized) ? toKatakana(normalized) : normalized,
  };
}

/**
 * Check if a text matches a search term (with romaji support)
 */
export function matchesSearch(text: string, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true;
  const { original, hiragana, katakana } = getSearchVariants(searchTerm);
  const lower = text.toLowerCase();
  return lower.includes(original) || lower.includes(hiragana) || lower.includes(katakana);
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search...",
  suggestions,
  onSelect,
  showSuggestions = false,
  className,
}: SearchBoxProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      onChange(newValue);
      if (showSuggestions && suggestions && suggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(-1);
      }
    },
    [onChange, showSuggestions, suggestions]
  );

  const handleClear = useCallback(() => {
    setInputValue("");
    onChange("");
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  const handleSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      setInputValue(suggestion.label);
      onChange(suggestion.label);
      setIsOpen(false);
      onSelect?.(suggestion);
    },
    [onChange, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || !suggestions || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setIsOpen(true);
          setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case "Enter":
          if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
            e.preventDefault();
            handleSelect(suggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [showSuggestions, suggestions, highlightedIndex, handleSelect]
  );

  const filteredSuggestions = suggestions?.filter(
    (s) => matchesSearch(s.label, inputValue) || matchesSearch(s.sublabel || "", inputValue)
  );

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (showSuggestions && filteredSuggestions && filteredSuggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Autocomplete dropdown */}
      {showSuggestions && isOpen && filteredSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelect(suggestion)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                index === highlightedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
              type="button"
            >
              <div className="font-medium">{suggestion.label}</div>
              {suggestion.sublabel && (
                <div className="text-xs text-muted-foreground">{suggestion.sublabel}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
