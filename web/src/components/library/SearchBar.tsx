import { useState, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search stories...",
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Pass original value - filtering hook handles conversions
      onChange(newValue);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setInputValue("");
    onChange("");
  }, [onChange]);

  return (
    <div className="relative group">
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
          isFocused ? "text-accent" : "text-foreground-muted"
        }`}
      />
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
