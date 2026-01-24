# Common Tasks

This document covers step-by-step instructions for common administrative and content management tasks.

## Deploying Convex Changes

**IMPORTANT: Always deploy to BOTH dev and prod when making Convex changes.**

```bash
# Deploy to dev
cd web && npx convex dev --once

# Deploy to prod
cd web && npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes
```

### Adding a new Convex function
1. Add to appropriate file in `web/convex/`
2. Export as `query` or `mutation`
3. Deploy to both dev and prod (see above)

### Adding a new table
1. Add table definition in `web/convex/schema.ts`
2. Create corresponding functions file
3. Deploy to both dev and prod (see above)

### Testing Convex functions
Use the Convex dashboard at https://dashboard.convex.dev to:
- View data in tables
- Run functions manually
- Check logs

---

## Adding YouTube Videos

Videos are stored in Convex with transcripts and comprehension questions.

### Method 1: CLI Script (Recommended)

Use the automated script that fetches metadata, parses transcripts, and generates questions:

```bash
cd web

# Set the Convex URL
export VITE_CONVEX_URL=$(grep VITE_CONVEX_URL .env.local | cut -d'=' -f2)

# Add a video with manual transcript input
npx tsx scripts/addVideo.ts "https://youtube.com/watch?v=abc123" japanese N4 --manual

# Or provide a transcript file (copy from YouTube's "Show transcript")
npx tsx scripts/addVideo.ts "https://youtube.com/watch?v=abc123" japanese N4 transcript.txt

# Skip AI question generation
npx tsx scripts/addVideo.ts "https://youtube.com/watch?v=abc123" japanese N4 --manual --no-questions
```

**Transcript file format** (copy from YouTube → "..." → "Show transcript"):
```
0:05 First line of text
0:13 Second line continues
1:30 And so on with timestamps
```

The script will:
1. Fetch video title and metadata automatically
2. Parse the transcript with timestamps
3. Save to Convex database
4. Generate 3-5 comprehension questions via AI

### Method 2: Manual (videoData.ts)

For bulk additions or when you need full control:

1. **Edit**: `web/convex/videoData.ts`
2. **Add to `VIDEOS` array**:
```typescript
{
  videoId: "abc123",           // YouTube ID (11 chars)
  language: "japanese",        // "japanese" | "english" | "french"
  level: "N4",                 // JLPT (N5-N1) or CEFR (A1-C2)
  title: "Video Title",
  description: "Brief description.",
  duration: 180,
  transcript: [
    { text: "First line", start: 0, duration: 3 },
    { text: "Second line", start: 3, duration: 4 },
  ],
  questions: [
    {
      question: "What is discussed?",
      type: "multiple_choice",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A",
    },
    // ... at least 3 questions
  ],
}
```
3. **Seed**: `npx convex run youtubeContent:seedAllVideos --push`
4. **Deploy**: `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes`

**Video Requirements:**
- Real YouTube videos need 11-character video ID
- Japanese levels: N5, N4, N3, N2, N1
- Other languages: A1, A2, B1, B2, C1, C2
- Minimum 3 comprehension questions per video

---

## Managing Premade Vocabulary Decks

Premade decks contain pre-generated sentences/audio for common vocabulary (JLPT N5-N1, CEFR levels). Users can import these decks without incurring AI costs.

### Creating and Importing Decks

```bash
cd web

# Set environment variables
export VITE_CONVEX_URL=$(grep VITE_CONVEX_URL .env.local | cut -d'=' -f2)
export GEMINI_API_KEY=your_key_here

# 1. Create a new deck
npx tsx scripts/importWordList.ts --create-deck jlpt_n5 \
  --name "JLPT N5" \
  --language japanese \
  --level N5 \
  --description "Essential vocabulary for JLPT N5"

# 2. Import words from CSV (format: word,reading,definition)
npx tsx scripts/importWordList.ts --import jlpt_n5 --file data/jlpt_n5.csv

# 3. Check deck stats
npx tsx scripts/importWordList.ts --stats jlpt_n5

# 4. List all decks
npx tsx scripts/importWordList.ts --list-decks
```

### Creating Cross-Deck Content (e.g., "Top 1000 Words")

When creating decks that overlap with existing ones, use `--copy-existing` to reuse generated content:

```bash
# Create the deck
npx tsx scripts/importWordList.ts --create-deck top_1000_jp \
  --name "Top 1000 Japanese Words" \
  --language japanese \
  --level N4

# Import with content copying (saves AI generation costs)
npx tsx scripts/importWordList.ts --import top_1000_jp \
  --file data/top_1000_japanese.csv \
  --copy-existing

# Check how many still need generation
npx tsx scripts/importWordList.ts --stats top_1000_jp
```

The script will show:
- `Copied content from other decks: X` - Words that already had content in JLPT decks
- `Still need generation: Y` - Words that need AI sentence generation

### Batch Generating Content (Python Pipeline)

The Python pipeline in `backend/scripts/` generates sentences, audio, and images locally with compression, then uploads to Convex.

**Models used:**
- Sentences: `gemini-3-flash-preview` (batches 20 words per prompt for efficiency)
- Audio: `gemini-2.5-flash-preview-tts` (compressed to MP3 via ffmpeg)
- Images: `gemini-2.5-flash-image` (compressed to WebP via PIL)

**IMPORTANT: Cost considerations**
- **Sentences only** by default - audio and images are significantly more expensive
- Only generate audio/images when explicitly requested by the user
- Cost estimates: Sentences ~$0.001/word, Audio ~$0.002/word, Images ~$0.02/word

```bash
cd backend

# Set environment variables
export GEMINI_API_KEY=your_key_here
export VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Step 1: Generate sentences from CSV
python scripts/batch_generate_deck.py \
  --import-csv data/jlpt_n5.csv \
  --language japanese \
  --level N5 \
  --type sentences \
  --count 100

# Step 2: Generate audio (after sentences exist)
python scripts/batch_generate_deck.py \
  --import-csv data/jlpt_n5.csv \
  --language japanese \
  --level N5 \
  --type audio \
  --count 100

# Step 3: Generate images
python scripts/batch_generate_deck.py \
  --import-csv data/jlpt_n5.csv \
  --language japanese \
  --level N5 \
  --type images \
  --count 50

# Step 4: Upload to Convex
python scripts/upload_to_convex.py \
  --results generated/results.json \
  --deck jlpt_n5
```

**Multi-word batching:** Sentences are generated 20 words at a time in a single prompt. This saves ~65% on token costs by amortizing the system prompt.

**Level context:** Each batch prompt includes difficulty-appropriate guidance:
- Grammar patterns appropriate for the level
- Vocabulary complexity hints
- Sentence length guidelines

**Cost estimates:**
- Sentences: ~$0.001/word (20 words/prompt × ~125 tokens = ~$0.0005 per word)
- Audio: ~$0.002/word
- Images: ~$0.02/word

### Publishing Decks for Users

After content generation is complete:

```typescript
// In Convex dashboard or via script
await convex.mutation(api.premadeDecks.setDeckPublished, {
  deckId: "jlpt_n5",
  isPublished: true,
});
```

### Data Model

```
premadeDecks        → Deck metadata (name, stats, published status)
premadeVocabulary   → Words with pre-generated content (linked to deck)
batchJobs           → Tracks generation jobs and costs
```

**Key behaviors:**
- Words are checked for duplicates within the same deck (skipped if exists)
- User import checks for duplicates in user's vocabulary (skipped if exists)
- `--copy-existing` flag copies content from ANY deck with the same word/language
- Each deck has its own vocabulary entries (allows deck-specific sentences if needed)

### Word List Sources

- [GitHub elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) - CSV format, all JLPT levels
- [Kaggle JLPT by level](https://www.kaggle.com/datasets/robinpourtaud/jlpt-words-by-level)
- [Tanos.co.uk](https://www.tanos.co.uk/jlpt/skills/vocab/) - Official-style lists
