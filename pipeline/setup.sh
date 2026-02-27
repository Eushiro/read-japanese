#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }

# ── Phase 0: Prerequisites ──────────────────────────────────────────

info "Phase 0: Checking prerequisites..."

if ! command -v bun &> /dev/null; then
  echo "Error: bun is required but not installed."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  info "Installing dependencies..."
  bun install
fi
ok "Prerequisites OK"

# ── Phase 1: Create directories ─────────────────────────────────────

info "Phase 1: Creating directories..."

mkdir -p downloads
mkdir -p reference/japanese_vocab
mkdir -p reference/english_vocab
mkdir -p reference/french_vocab
mkdir -p reference/grammar_constraints
mkdir -p reference/japanese_grammar
mkdir -p reference/english_grammar
mkdir -p reference/french_grammar

ok "Directories created"

# ── Phase 2: Download external files ────────────────────────────────

info "Phase 2: Downloading external files..."

# CEFR-J Vocabulary Profile
CEFRJ_VOCAB="downloads/cefrj-vocabulary-profile-1.5.csv"
if [ ! -f "$CEFRJ_VOCAB" ]; then
  info "  Downloading CEFR-J vocabulary profile..."
  curl -fSL -o "$CEFRJ_VOCAB" \
    "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv"
  ok "  CEFR-J vocabulary downloaded"
else
  ok "  CEFR-J vocabulary already present"
fi

# Octanove C1-C2 Vocabulary
OCTANOVE="downloads/octanove-vocabulary-profile-c1c2-1.0.csv"
if [ ! -f "$OCTANOVE" ]; then
  info "  Downloading Octanove C1-C2 vocabulary..."
  curl -fSL -o "$OCTANOVE" \
    "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv"
  ok "  Octanove vocabulary downloaded"
else
  ok "  Octanove vocabulary already present"
fi

# CEFR-J Grammar Profile
CEFRJ_GRAMMAR="downloads/cefrj-grammar-profile-20180315.csv"
if [ ! -f "$CEFRJ_GRAMMAR" ]; then
  info "  Downloading CEFR-J grammar profile..."
  curl -fSL -o "$CEFRJ_GRAMMAR" \
    "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-grammar-profile-20180315.csv"
  ok "  CEFR-J grammar downloaded"
else
  ok "  CEFR-J grammar already present"
fi

# FLELex Beacco TSV (French vocabulary)
FLELEX="downloads/FleLex_TT_Beacco.tsv"
if [ ! -f "$FLELEX" ]; then
  info "  Downloading FLELex Beacco TSV..."
  curl -fSL -o "$FLELEX" \
    "https://cental.uclouvain.be/cefrlex/static/resources/fr/FleLex_TT_Beacco.tsv"
  ok "  FLELex Beacco downloaded"
else
  ok "  FLELex Beacco already present"
fi

ok "Downloads complete"

# ── Phase 3: Copy local data ────────────────────────────────────────

info "Phase 3: Copying local data..."

# Japanese vocab source files (parsers read directly from backend/app/data/jlpt/)
ok "  Japanese vocab files at $ROOT_DIR/backend/app/data/jlpt/"

# Grammar constraints
cp "$ROOT_DIR/backend/app/data/jlpt/grammar/grammar_constraints.json" \
   reference/grammar_constraints/japanese.json
ok "  Japanese grammar constraints copied"

cp "$ROOT_DIR/backend/app/data/cefr/grammar/english_grammar_constraints.json" \
   reference/grammar_constraints/english.json
ok "  English grammar constraints copied"

cp "$ROOT_DIR/backend/app/data/cefr/grammar/french_grammar_constraints.json" \
   reference/grammar_constraints/french.json
ok "  French grammar constraints copied"

# Japanese grammar CSV
JLPT_GRAMMAR_SRC="$HOME/Desktop/JLPT Grammar.xlsx - full list.csv"
JLPT_GRAMMAR_DST="downloads/jlpt-grammar-full-list.csv"
if [ -f "$JLPT_GRAMMAR_SRC" ]; then
  cp "$JLPT_GRAMMAR_SRC" "$JLPT_GRAMMAR_DST"
  ok "  JLPT grammar CSV copied"
else
  warn "  JLPT grammar CSV not found at: $JLPT_GRAMMAR_SRC"
  warn "  Japanese grammar parsing will be skipped"
fi

ok "Local data copied"

# ── Phase 4: Run parsers ────────────────────────────────────────────

info "Phase 4: Running parsers..."

echo ""
info "── Japanese Vocab ──"
bunx tsx parsers/parse-japanese-vocab.ts

echo ""
info "── English Vocab ──"
bunx tsx parsers/parse-english-vocab.ts

echo ""
info "── French Vocab ──"
bunx tsx parsers/parse-french-vocab.ts

echo ""
info "── Japanese Grammar ──"
if [ -f "$JLPT_GRAMMAR_DST" ]; then
  bunx tsx parsers/parse-japanese-grammar.ts
else
  warn "Skipped (source CSV not found)"
fi

echo ""
info "── English Grammar ──"
bunx tsx parsers/parse-english-grammar.ts

ok "All parsers complete"

# ── Phase 5: Summary ────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════"
echo " Pipeline Setup Complete"
echo "════════════════════════════════════════════════════"
echo ""

count_csv_rows() {
  local file="$1"
  if [ -f "$file" ]; then
    # Subtract 1 for header row
    echo $(( $(wc -l < "$file") - 1 ))
  else
    echo "MISSING"
  fi
}

count_json_array() {
  local file="$1"
  if [ -f "$file" ]; then
    # Count array elements (lines starting with {)
    grep -c '^\s*{' "$file" || echo "0"
  else
    echo "MISSING"
  fi
}

echo " Japanese Vocab:"
for level in N5 N4 N3 N2 N1; do
  printf "   %-4s %s words\n" "$level" "$(count_csv_rows "reference/japanese_vocab/$level.csv")"
done

echo ""
echo " English Vocab:"
for level in A1 A2 B1 B2 C1 C2; do
  printf "   %-4s %s words\n" "$level" "$(count_csv_rows "reference/english_vocab/$level.csv")"
done

echo ""
echo " French Vocab:"
for level in A1 A2 B1 B2 C1 C2; do
  printf "   %-4s %s words\n" "$level" "$(count_csv_rows "reference/french_vocab/$level.csv")"
done

echo ""
echo " Japanese Grammar:"
for level in N5 N4 N3 N2 N1; do
  printf "   %-4s %s points\n" "$level" "$(count_json_array "reference/japanese_grammar/$level.json")"
done

echo ""
echo " English Grammar:"
for level in A1 A2 B1 B2 C1 C2; do
  printf "   %-4s %s points\n" "$level" "$(count_json_array "reference/english_grammar/$level.json")"
done

echo ""
echo " Grammar Constraints:"
for lang in japanese english french; do
  if [ -f "reference/grammar_constraints/$lang.json" ]; then
    printf "   %-10s ✓\n" "$lang"
  else
    printf "   %-10s MISSING\n" "$lang"
  fi
done

echo ""
ok "Done! Reference data is in pipeline/reference/"
