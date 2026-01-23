/**
 * YouTube Video Data for Seeding
 *
 * HOW TO ADD NEW VIDEOS:
 * 1. Add a new entry to the VIDEOS array below
 * 2. Run: npx convex run youtubeContent:seedAllVideos
 * 3. For production: npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes
 *
 * VIDEO REQUIREMENTS:
 * - videoId: YouTube video ID (11 chars) OR custom ID for demo content (e.g., "jp_n5_intro")
 * - language: "japanese" | "english" | "french"
 * - level: JLPT (N5-N1) for Japanese, CEFR (A1-C2) for English/French
 * - title: Keep under 100 characters
 * - description: 1-2 sentences about the video content
 * - duration: Video length in seconds
 * - transcript: Array of { text, start (seconds), duration (seconds) }
 * - questions: 3-5 multiple choice questions per video
 *
 * TIPS:
 * - For real YouTube videos, use the 11-character video ID from the URL
 * - For demo content, use descriptive IDs like "jp_n5_intro", "en_a1_greetings"
 * - Demo videos show a placeholder instead of embedded YouTube player
 * - Each question needs: question, type ("multiple_choice"), options (array), correctAnswer
 */

// Types
export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface VideoQuestion {
  question: string;
  type: "multiple_choice";
  options: string[];
  correctAnswer: string;
  timestamp?: number;
}

export interface VideoData {
  videoId: string;
  language: "japanese" | "english" | "french";
  level: string;
  title: string;
  description: string;
  duration: number;
  transcript: TranscriptSegment[];
  questions: VideoQuestion[];
}

// ============================================
// VIDEO DATA - Edit this array to add/modify videos
// ============================================

export const VIDEOS: VideoData[] = [
  // ============================================
  // JAPANESE VIDEOS (5)
  // ============================================
  {
    videoId: "jp_n5_intro",
    language: "japanese",
    level: "N5",
    title: "はじめまして - Meeting People in Japanese",
    description:
      "Learn essential phrases for introducing yourself and meeting new people in Japanese.",
    duration: 180,
    transcript: [
      { text: "皆さん、こんにちは。", start: 0, duration: 2 },
      { text: "今日は自己紹介について勉強しましょう。", start: 2, duration: 4 },
      { text: "まず、「はじめまして」と言います。", start: 6, duration: 3 },
      {
        text: "「はじめまして」は英語で「Nice to meet you」です。",
        start: 9,
        duration: 4,
      },
      { text: "次に、名前を言います。", start: 13, duration: 3 },
      { text: "「私の名前は田中です。」", start: 16, duration: 3 },
      { text: "または「田中と申します。」", start: 19, duration: 3 },
      { text: "「と申します」はもっと丁寧な言い方です。", start: 22, duration: 4 },
      {
        text: "最後に、「よろしくお願いします」と言います。",
        start: 26,
        duration: 4,
      },
      {
        text: "これは「Please be kind to me」という意味です。",
        start: 30,
        duration: 4,
      },
    ],
    questions: [
      {
        question: "「はじめまして」は英語で何ですか？",
        type: "multiple_choice",
        options: ["Hello", "Nice to meet you", "Goodbye", "Thank you"],
        correctAnswer: "Nice to meet you",
        timestamp: 6,
      },
      {
        question: "「と申します」はどんな言い方ですか？",
        type: "multiple_choice",
        options: [
          "カジュアルな言い方",
          "丁寧な言い方",
          "子供の言い方",
          "古い言い方",
        ],
        correctAnswer: "丁寧な言い方",
        timestamp: 19,
      },
      {
        question: "自己紹介の最後に何と言いますか？",
        type: "multiple_choice",
        options: [
          "さようなら",
          "ありがとうございます",
          "よろしくお願いします",
          "すみません",
        ],
        correctAnswer: "よろしくお願いします",
        timestamp: 26,
      },
    ],
  },
  {
    videoId: "jp_n5_numbers",
    language: "japanese",
    level: "N5",
    title: "日本語の数字 - Numbers in Japanese",
    description:
      "Master counting from 1 to 100 in Japanese with proper pronunciation.",
    duration: 240,
    transcript: [
      { text: "今日は数字を勉強しましょう。", start: 0, duration: 3 },
      { text: "一、二、三、四、五。", start: 3, duration: 4 },
      { text: "「四」は「し」または「よん」と読みます。", start: 7, duration: 4 },
      { text: "六、七、八、九、十。", start: 11, duration: 4 },
      { text: "「七」は「しち」または「なな」と読みます。", start: 15, duration: 4 },
      { text: "十一は「じゅういち」です。", start: 19, duration: 3 },
      { text: "二十は「にじゅう」です。", start: 22, duration: 3 },
      { text: "百は「ひゃく」です。", start: 25, duration: 3 },
      { text: "数字は買い物でとても大切です。", start: 28, duration: 4 },
    ],
    questions: [
      {
        question: "「四」の読み方は何ですか？",
        type: "multiple_choice",
        options: ["しだけ", "よんだけ", "しまたはよん", "よまたはし"],
        correctAnswer: "しまたはよん",
        timestamp: 7,
      },
      {
        question: "「七」は何と読みますか？",
        type: "multiple_choice",
        options: ["しちまたはなな", "ななだけ", "しちだけ", "はち"],
        correctAnswer: "しちまたはなな",
        timestamp: 15,
      },
      {
        question: "百は日本語で何と言いますか？",
        type: "multiple_choice",
        options: ["せん", "ひゃく", "まん", "じゅう"],
        correctAnswer: "ひゃく",
        timestamp: 25,
      },
    ],
  },
  {
    videoId: "jp_n5_family",
    language: "japanese",
    level: "N5",
    title: "家族の言葉 - Family Words in Japanese",
    description:
      "Learn how to talk about family members in Japanese with proper honorifics.",
    duration: 200,
    transcript: [
      { text: "家族について話しましょう。", start: 0, duration: 3 },
      { text: "私の父は「ちち」と言います。", start: 3, duration: 3 },
      { text: "他の人の父は「おとうさん」です。", start: 6, duration: 4 },
      { text: "私の母は「はは」と言います。", start: 10, duration: 3 },
      { text: "他の人の母は「おかあさん」です。", start: 13, duration: 4 },
      { text: "兄は「あに」、姉は「あね」です。", start: 17, duration: 4 },
      { text: "弟は「おとうと」、妹は「いもうと」です。", start: 21, duration: 4 },
      { text: "家族は大切ですね。", start: 25, duration: 3 },
    ],
    questions: [
      {
        question: "自分の父を何と言いますか？",
        type: "multiple_choice",
        options: ["おとうさん", "ちち", "パパ", "おじさん"],
        correctAnswer: "ちち",
        timestamp: 3,
      },
      {
        question: "他の人の母を何と言いますか？",
        type: "multiple_choice",
        options: ["はは", "おかあさん", "ママ", "おばさん"],
        correctAnswer: "おかあさん",
        timestamp: 13,
      },
      {
        question: "「あね」は誰ですか？",
        type: "multiple_choice",
        options: ["弟", "妹", "兄", "姉"],
        correctAnswer: "姉",
        timestamp: 17,
      },
    ],
  },
  {
    videoId: "jp_n4_teform",
    language: "japanese",
    level: "N4",
    title: "て形の使い方 - Using the Te-Form",
    description:
      "Master the essential Japanese て form for connecting actions and making requests.",
    duration: 300,
    transcript: [
      { text: "今日はて形を勉強します。", start: 0, duration: 3 },
      { text: "て形は動詞を繋げるときに使います。", start: 3, duration: 4 },
      { text: "例えば、「食べて、飲んで、寝ます」。", start: 7, duration: 4 },
      { text: "グループ1の動詞は変化が複雑です。", start: 11, duration: 4 },
      { text: "「書く」は「書いて」になります。", start: 15, duration: 3 },
      { text: "「飲む」は「飲んで」になります。", start: 18, duration: 3 },
      {
        text: "グループ2は簡単です。「る」を「て」に変えます。",
        start: 21,
        duration: 5,
      },
      { text: "「食べる」は「食べて」になります。", start: 26, duration: 3 },
      { text: "て形でお願いもできます。「見てください」。", start: 29, duration: 4 },
    ],
    questions: [
      {
        question: "て形は何のために使いますか？",
        type: "multiple_choice",
        options: ["過去を表す", "動詞を繋げる", "否定を表す", "質問をする"],
        correctAnswer: "動詞を繋げる",
        timestamp: 3,
      },
      {
        question: "「書く」のて形は何ですか？",
        type: "multiple_choice",
        options: ["書くて", "書って", "書いて", "書nte"],
        correctAnswer: "書いて",
        timestamp: 15,
      },
      {
        question: "「食べる」のて形は何ですか？",
        type: "multiple_choice",
        options: ["食べって", "食べて", "食べいて", "食べんで"],
        correctAnswer: "食べて",
        timestamp: 26,
      },
    ],
  },
  {
    videoId: "jp_n3_keigo",
    language: "japanese",
    level: "N3",
    title: "敬語の基本 - Introduction to Keigo",
    description:
      "Learn the basics of Japanese honorific language used in formal situations.",
    duration: 360,
    transcript: [
      { text: "敬語は日本語でとても大切です。", start: 0, duration: 4 },
      { text: "敬語には三つの種類があります。", start: 4, duration: 3 },
      { text: "尊敬語、謙譲語、丁寧語です。", start: 7, duration: 4 },
      { text: "尊敬語は相手を高めます。", start: 11, duration: 3 },
      { text: "「いらっしゃる」は「いる」の尊敬語です。", start: 14, duration: 4 },
      { text: "謙譲語は自分を低くします。", start: 18, duration: 3 },
      { text: "「参る」は「行く」の謙譲語です。", start: 21, duration: 4 },
      { text: "丁寧語は「です」「ます」を使います。", start: 25, duration: 4 },
      { text: "ビジネスでは敬語が必要です。", start: 29, duration: 3 },
    ],
    questions: [
      {
        question: "敬語には何種類ありますか？",
        type: "multiple_choice",
        options: ["一つ", "二つ", "三つ", "四つ"],
        correctAnswer: "三つ",
        timestamp: 4,
      },
      {
        question: "「いらっしゃる」は何の尊敬語ですか？",
        type: "multiple_choice",
        options: ["行く", "いる", "来る", "食べる"],
        correctAnswer: "いる",
        timestamp: 14,
      },
      {
        question: "謙譲語はどのような効果がありますか？",
        type: "multiple_choice",
        options: [
          "相手を高める",
          "自分を低くする",
          "丁寧にする",
          "カジュアルにする",
        ],
        correctAnswer: "自分を低くする",
        timestamp: 18,
      },
    ],
  },

  // ============================================
  // ENGLISH VIDEOS (5)
  // ============================================
  {
    videoId: "arj7oStGLkU",
    language: "english",
    level: "B1",
    title: "How Language Shapes the Way We Think",
    description:
      "Cognitive scientist Lera Boroditsky explores how the languages we speak shape the way we think.",
    duration: 840,
    transcript: [
      { text: "So I'll be speaking to you using language", start: 0, duration: 3 },
      { text: "because I can.", start: 3, duration: 2 },
      {
        text: "This is one of these magical abilities that we humans have.",
        start: 5,
        duration: 4,
      },
      {
        text: "We can transmit really complicated thoughts to one another.",
        start: 9,
        duration: 4,
      },
      { text: "So what I'm doing right now is", start: 13, duration: 2 },
      {
        text: "I'm making sounds with my mouth as I'm exhaling.",
        start: 15,
        duration: 4,
      },
      { text: "I'm making tones and hisses and puffs,", start: 19, duration: 3 },
      {
        text: "and those are creating air vibrations in the air.",
        start: 22,
        duration: 4,
      },
      {
        text: "Those air vibrations are traveling to you,",
        start: 26,
        duration: 3,
      },
      { text: "they're hitting your eardrums,", start: 29, duration: 2 },
      {
        text: "and then your brain takes those vibrations from your eardrums",
        start: 31,
        duration: 4,
      },
      { text: "and transforms them into thoughts.", start: 35, duration: 3 },
      { text: "I hope.", start: 38, duration: 2 },
      { text: "Now, because of this ability,", start: 40, duration: 2 },
      {
        text: "we humans are able to transmit our ideas across vast reaches of space and time.",
        start: 42,
        duration: 6,
      },
      {
        text: "We're able to transmit knowledge across minds.",
        start: 48,
        duration: 4,
      },
    ],
    questions: [
      {
        question: "What does the speaker describe as 'magical'?",
        type: "multiple_choice",
        options: [
          "The ability to hear sounds",
          "The ability to transmit complicated thoughts through language",
          "The ability to make sounds",
          "The ability to travel through time",
        ],
        correctAnswer:
          "The ability to transmit complicated thoughts through language",
        timestamp: 5,
      },
      {
        question:
          "How does language physically reach the listener according to the talk?",
        type: "multiple_choice",
        options: [
          "Through brain waves",
          "Through air vibrations hitting the eardrums",
          "Through visual signals",
          "Through telepathy",
        ],
        correctAnswer: "Through air vibrations hitting the eardrums",
        timestamp: 26,
      },
      {
        question: "What can humans do because of the ability to use language?",
        type: "multiple_choice",
        options: [
          "Read minds directly",
          "Transmit knowledge across minds and across space and time",
          "See the future",
          "Communicate only with nearby people",
        ],
        correctAnswer:
          "Transmit knowledge across minds and across space and time",
        timestamp: 42,
      },
    ],
  },
  {
    videoId: "en_a1_greetings",
    language: "english",
    level: "A1",
    title: "Basic English Greetings",
    description:
      "Learn essential greetings and introductions for everyday English conversations.",
    duration: 180,
    transcript: [
      {
        text: "Hello everyone! Today we will learn greetings.",
        start: 0,
        duration: 4,
      },
      { text: "The most common greeting is 'Hello'.", start: 4, duration: 3 },
      { text: "You can also say 'Hi' to friends.", start: 7, duration: 3 },
      { text: "In the morning, we say 'Good morning'.", start: 10, duration: 4 },
      {
        text: "In the afternoon, we say 'Good afternoon'.",
        start: 14,
        duration: 4,
      },
      { text: "In the evening, we say 'Good evening'.", start: 18, duration: 4 },
      {
        text: "When you meet someone new, say 'Nice to meet you'.",
        start: 22,
        duration: 4,
      },
      {
        text: "They will respond 'Nice to meet you too'.",
        start: 26,
        duration: 4,
      },
      {
        text: "When leaving, say 'Goodbye' or 'See you later'.",
        start: 30,
        duration: 4,
      },
    ],
    questions: [
      {
        question: "What do you say in the morning?",
        type: "multiple_choice",
        options: ["Good evening", "Good afternoon", "Good morning", "Good night"],
        correctAnswer: "Good morning",
        timestamp: 10,
      },
      {
        question: "What do you say when meeting someone new?",
        type: "multiple_choice",
        options: [
          "Goodbye",
          "Nice to meet you",
          "See you later",
          "Good morning",
        ],
        correctAnswer: "Nice to meet you",
        timestamp: 22,
      },
      {
        question: "Which greeting is informal?",
        type: "multiple_choice",
        options: ["Good morning", "Good afternoon", "Hi", "Good evening"],
        correctAnswer: "Hi",
        timestamp: 7,
      },
    ],
  },
  {
    videoId: "en_a2_daily",
    language: "english",
    level: "A2",
    title: "Talking About Daily Routines",
    description:
      "Learn vocabulary and phrases to describe your daily activities in English.",
    duration: 240,
    transcript: [
      { text: "Let's talk about daily routines.", start: 0, duration: 3 },
      {
        text: "I wake up at seven o'clock every morning.",
        start: 3,
        duration: 4,
      },
      {
        text: "First, I brush my teeth and take a shower.",
        start: 7,
        duration: 4,
      },
      {
        text: "Then I eat breakfast. I usually have toast and coffee.",
        start: 11,
        duration: 5,
      },
      { text: "I go to work at eight thirty.", start: 16, duration: 3 },
      { text: "I work from nine to five.", start: 19, duration: 3 },
      {
        text: "For lunch, I often eat at a restaurant near my office.",
        start: 22,
        duration: 5,
      },
      { text: "After work, I go to the gym.", start: 27, duration: 3 },
      { text: "I have dinner at seven and watch TV.", start: 30, duration: 4 },
      { text: "I go to bed at eleven o'clock.", start: 34, duration: 3 },
    ],
    questions: [
      {
        question: "What time does the speaker wake up?",
        type: "multiple_choice",
        options: [
          "Six o'clock",
          "Seven o'clock",
          "Eight o'clock",
          "Nine o'clock",
        ],
        correctAnswer: "Seven o'clock",
        timestamp: 3,
      },
      {
        question: "What does the speaker usually have for breakfast?",
        type: "multiple_choice",
        options: [
          "Rice and eggs",
          "Toast and coffee",
          "Cereal and milk",
          "Fruit and yogurt",
        ],
        correctAnswer: "Toast and coffee",
        timestamp: 11,
      },
      {
        question: "What does the speaker do after work?",
        type: "multiple_choice",
        options: ["Watch TV", "Go to the gym", "Have dinner", "Go shopping"],
        correctAnswer: "Go to the gym",
        timestamp: 27,
      },
    ],
  },
  {
    videoId: "en_a2_shopping",
    language: "english",
    level: "A2",
    title: "Shopping Conversations",
    description:
      "Practice common phrases and vocabulary for shopping in English.",
    duration: 200,
    transcript: [
      { text: "Today we'll learn shopping phrases.", start: 0, duration: 3 },
      {
        text: "When you enter a store, the clerk might say 'Can I help you?'",
        start: 3,
        duration: 5,
      },
      {
        text: "You can say 'I'm just looking, thank you.'",
        start: 8,
        duration: 4,
      },
      {
        text: "Or 'Yes, I'm looking for a blue shirt.'",
        start: 12,
        duration: 4,
      },
      {
        text: "To ask about price, say 'How much is this?'",
        start: 16,
        duration: 4,
      },
      { text: "Or 'How much does this cost?'", start: 20, duration: 3 },
      {
        text: "To try something on, ask 'Can I try this on?'",
        start: 23,
        duration: 4,
      },
      {
        text: "The fitting room is usually at the back of the store.",
        start: 27,
        duration: 4,
      },
      {
        text: "When paying, you can ask 'Do you accept credit cards?'",
        start: 31,
        duration: 4,
      },
    ],
    questions: [
      {
        question: "What can you say if you're not looking for anything specific?",
        type: "multiple_choice",
        options: [
          "How much is this?",
          "I'm just looking",
          "Can I try this on?",
          "Where is the fitting room?",
        ],
        correctAnswer: "I'm just looking",
        timestamp: 8,
      },
      {
        question: "How do you ask about the price?",
        type: "multiple_choice",
        options: [
          "Can I help you?",
          "How much is this?",
          "Can I try this on?",
          "Where is this from?",
        ],
        correctAnswer: "How much is this?",
        timestamp: 16,
      },
      {
        question: "What do you ask when you want to try clothes?",
        type: "multiple_choice",
        options: [
          "How much is this?",
          "Can I help you?",
          "Can I try this on?",
          "Do you accept credit cards?",
        ],
        correctAnswer: "Can I try this on?",
        timestamp: 23,
      },
    ],
  },
  {
    videoId: "en_b1_idioms",
    language: "english",
    level: "B1",
    title: "Common English Idioms",
    description:
      "Learn popular English idioms and their meanings for more natural conversation.",
    duration: 280,
    transcript: [
      {
        text: "Idioms make English more colorful and natural.",
        start: 0,
        duration: 4,
      },
      {
        text: "'It's raining cats and dogs' means it's raining very heavily.",
        start: 4,
        duration: 5,
      },
      { text: "It has nothing to do with animals!", start: 9, duration: 3 },
      {
        text: "'Break a leg' is what we say to wish someone good luck.",
        start: 12,
        duration: 5,
      },
      {
        text: "Actors often hear this before a performance.",
        start: 17,
        duration: 4,
      },
      {
        text: "'Piece of cake' means something is very easy.",
        start: 21,
        duration: 4,
      },
      {
        text: "For example, 'The test was a piece of cake.'",
        start: 25,
        duration: 4,
      },
      { text: "'Hit the books' means to study hard.", start: 29, duration: 4 },
      {
        text: "Students use this idiom a lot before exams.",
        start: 33,
        duration: 4,
      },
      {
        text: "'Cost an arm and a leg' means very expensive.",
        start: 37,
        duration: 4,
      },
    ],
    questions: [
      {
        question: "What does 'It's raining cats and dogs' mean?",
        type: "multiple_choice",
        options: [
          "Animals are falling",
          "It's raining heavily",
          "Pets are outside",
          "The weather is nice",
        ],
        correctAnswer: "It's raining heavily",
        timestamp: 4,
      },
      {
        question: "When would someone say 'Break a leg'?",
        type: "multiple_choice",
        options: [
          "When someone is hurt",
          "To wish good luck",
          "When something breaks",
          "To say goodbye",
        ],
        correctAnswer: "To wish good luck",
        timestamp: 12,
      },
      {
        question: "What does 'Piece of cake' mean?",
        type: "multiple_choice",
        options: [
          "A type of dessert",
          "Something very easy",
          "A birthday party",
          "Something delicious",
        ],
        correctAnswer: "Something very easy",
        timestamp: 21,
      },
    ],
  },

  // ============================================
  // FRENCH VIDEOS (5)
  // ============================================
  {
    videoId: "fr_a1_intro",
    language: "french",
    level: "A1",
    title: "Se Présenter - Introducing Yourself in French",
    description:
      "Learn the essential phrases for introducing yourself in French conversations.",
    duration: 180,
    transcript: [
      { text: "Bonjour à tous!", start: 0, duration: 2 },
      {
        text: "Aujourd'hui, nous allons apprendre à nous présenter.",
        start: 2,
        duration: 4,
      },
      { text: "Commençons par le plus simple.", start: 6, duration: 3 },
      { text: "Je m'appelle Marie.", start: 9, duration: 2 },
      {
        text: "C'est la façon la plus commune de dire son nom.",
        start: 11,
        duration: 4,
      },
      {
        text: "Vous pouvez aussi dire: 'Mon nom est Marie.'",
        start: 15,
        duration: 4,
      },
      {
        text: "Ensuite, vous pouvez dire d'où vous venez.",
        start: 19,
        duration: 3,
      },
      { text: "'Je viens de Paris.'", start: 22, duration: 2 },
      { text: "Ou 'Je suis français' pour un homme.", start: 24, duration: 3 },
      { text: "'Je suis française' pour une femme.", start: 27, duration: 3 },
      {
        text: "Finalement, on dit 'Enchanté' ou 'Enchantée'.",
        start: 30,
        duration: 4,
      },
      {
        text: "C'est comme 'Nice to meet you' en anglais.",
        start: 34,
        duration: 3,
      },
    ],
    questions: [
      {
        question: "Comment dit-on son nom en français?",
        type: "multiple_choice",
        options: [
          "Je suis Marie",
          "Je m'appelle Marie",
          "Je viens de Marie",
          "Je parle Marie",
        ],
        correctAnswer: "Je m'appelle Marie",
        timestamp: 9,
      },
      {
        question: "Comment dit-on d'où on vient?",
        type: "multiple_choice",
        options: [
          "Je suis de Paris",
          "Je parle Paris",
          "Je viens de Paris",
          "Je m'appelle Paris",
        ],
        correctAnswer: "Je viens de Paris",
        timestamp: 19,
      },
      {
        question: "Que dit-on pour 'Nice to meet you'?",
        type: "multiple_choice",
        options: ["Bonjour", "Au revoir", "Enchanté/Enchantée", "Merci"],
        correctAnswer: "Enchanté/Enchantée",
        timestamp: 30,
      },
    ],
  },
  {
    videoId: "fr_a1_numbers",
    language: "french",
    level: "A1",
    title: "Les Nombres en Français - French Numbers",
    description:
      "Master counting from 1 to 100 in French with correct pronunciation.",
    duration: 240,
    transcript: [
      { text: "Aujourd'hui, nous apprenons les nombres.", start: 0, duration: 3 },
      { text: "Un, deux, trois, quatre, cinq.", start: 3, duration: 4 },
      { text: "Six, sept, huit, neuf, dix.", start: 7, duration: 4 },
      {
        text: "Attention à la prononciation de 'cinq' et 'six'.",
        start: 11,
        duration: 4,
      },
      { text: "Onze, douze, treize, quatorze, quinze.", start: 15, duration: 4 },
      {
        text: "Seize, dix-sept, dix-huit, dix-neuf, vingt.",
        start: 19,
        duration: 5,
      },
      { text: "Vingt et un, vingt-deux, vingt-trois...", start: 24, duration: 4 },
      { text: "Trente, quarante, cinquante, soixante.", start: 28, duration: 4 },
      {
        text: "Soixante-dix est spécial: c'est 60 + 10.",
        start: 32,
        duration: 4,
      },
      { text: "Quatre-vingts, c'est 4 × 20.", start: 36, duration: 3 },
    ],
    questions: [
      {
        question: "Comment dit-on '15' en français?",
        type: "multiple_choice",
        options: ["Cinq", "Quinze", "Cinquante", "Quatorze"],
        correctAnswer: "Quinze",
        timestamp: 15,
      },
      {
        question: "Comment forme-t-on 'soixante-dix'?",
        type: "multiple_choice",
        options: ["7 × 10", "60 + 10", "6 × 10", "70 + 0"],
        correctAnswer: "60 + 10",
        timestamp: 32,
      },
      {
        question: "Que signifie 'quatre-vingts'?",
        type: "multiple_choice",
        options: ["40", "80 (4 × 20)", "48", "84"],
        correctAnswer: "80 (4 × 20)",
        timestamp: 36,
      },
    ],
  },
  {
    videoId: "fr_a1_food",
    language: "french",
    level: "A1",
    title: "La Nourriture - Food Vocabulary",
    description:
      "Learn essential food vocabulary for ordering at restaurants and shopping.",
    duration: 200,
    transcript: [
      { text: "Parlons de la nourriture française!", start: 0, duration: 3 },
      { text: "Le pain est très important en France.", start: 3, duration: 4 },
      { text: "On achète le pain à la boulangerie.", start: 7, duration: 3 },
      { text: "Le fromage est aussi très populaire.", start: 10, duration: 3 },
      {
        text: "Il y a plus de 400 types de fromage en France!",
        start: 13,
        duration: 4,
      },
      {
        text: "Les fruits: une pomme, une orange, une banane.",
        start: 17,
        duration: 4,
      },
      {
        text: "Les légumes: une tomate, une carotte, une salade.",
        start: 21,
        duration: 4,
      },
      {
        text: "Pour le petit-déjeuner, on mange des croissants.",
        start: 25,
        duration: 4,
      },
      {
        text: "Pour le déjeuner et le dîner, on mange un plat principal.",
        start: 29,
        duration: 5,
      },
    ],
    questions: [
      {
        question: "Où achète-t-on le pain?",
        type: "multiple_choice",
        options: [
          "À la pharmacie",
          "À la boulangerie",
          "Au supermarché",
          "Au restaurant",
        ],
        correctAnswer: "À la boulangerie",
        timestamp: 7,
      },
      {
        question: "Combien de types de fromage y a-t-il en France?",
        type: "multiple_choice",
        options: ["Plus de 100", "Plus de 200", "Plus de 400", "Plus de 1000"],
        correctAnswer: "Plus de 400",
        timestamp: 13,
      },
      {
        question: "Que mange-t-on pour le petit-déjeuner?",
        type: "multiple_choice",
        options: ["Une salade", "Des croissants", "Du fromage", "Une tomate"],
        correctAnswer: "Des croissants",
        timestamp: 25,
      },
    ],
  },
  {
    videoId: "fr_a2_directions",
    language: "french",
    level: "A2",
    title: "Demander Son Chemin - Asking for Directions",
    description: "Learn how to ask for and give directions in French.",
    duration: 220,
    transcript: [
      {
        text: "Comment demander son chemin en français?",
        start: 0,
        duration: 3,
      },
      { text: "D'abord, soyez poli: 'Excusez-moi'.", start: 3, duration: 4 },
      { text: "'Où est la gare, s'il vous plaît?'", start: 7, duration: 3 },
      { text: "'Comment aller à la poste?'", start: 10, duration: 3 },
      { text: "Pour les directions: 'Allez tout droit.'", start: 13, duration: 4 },
      {
        text: "'Tournez à gauche' ou 'Tournez à droite.'",
        start: 17,
        duration: 4,
      },
      { text: "'C'est à côté de la banque.'", start: 21, duration: 3 },
      { text: "'C'est en face du restaurant.'", start: 24, duration: 3 },
      { text: "'C'est au coin de la rue.'", start: 27, duration: 3 },
      { text: "N'oubliez pas de dire 'Merci beaucoup!'", start: 30, duration: 3 },
    ],
    questions: [
      {
        question: "Comment commence-t-on une question polie?",
        type: "multiple_choice",
        options: ["Bonjour", "Excusez-moi", "Merci", "Au revoir"],
        correctAnswer: "Excusez-moi",
        timestamp: 3,
      },
      {
        question: "Comment dit-on 'Go straight'?",
        type: "multiple_choice",
        options: [
          "Tournez à gauche",
          "Tournez à droite",
          "Allez tout droit",
          "C'est au coin",
        ],
        correctAnswer: "Allez tout droit",
        timestamp: 13,
      },
      {
        question: "Que signifie 'C'est en face du restaurant'?",
        type: "multiple_choice",
        options: [
          "It's next to the restaurant",
          "It's across from the restaurant",
          "It's behind the restaurant",
          "It's inside the restaurant",
        ],
        correctAnswer: "It's across from the restaurant",
        timestamp: 24,
      },
    ],
  },
  {
    videoId: "fr_b1_passe",
    language: "french",
    level: "B1",
    title: "Le Passé Composé - Past Tense in French",
    description:
      "Master the French past tense with être and avoir auxiliaries.",
    duration: 300,
    transcript: [
      {
        text: "Le passé composé est un temps très utilisé.",
        start: 0,
        duration: 4,
      },
      {
        text: "Il se forme avec un auxiliaire et un participe passé.",
        start: 4,
        duration: 4,
      },
      {
        text: "La plupart des verbes utilisent 'avoir'.",
        start: 8,
        duration: 4,
      },
      {
        text: "'J'ai mangé', 'tu as parlé', 'il a fini'.",
        start: 12,
        duration: 4,
      },
      {
        text: "Certains verbes utilisent 'être' comme auxiliaire.",
        start: 16,
        duration: 4,
      },
      {
        text: "Ce sont les verbes de mouvement et les verbes pronominaux.",
        start: 20,
        duration: 5,
      },
      {
        text: "'Je suis allé', 'elle est partie', 'nous sommes arrivés'.",
        start: 25,
        duration: 5,
      },
      {
        text: "Avec 'être', le participe passé s'accorde avec le sujet.",
        start: 30,
        duration: 5,
      },
      { text: "'Elle est allée' mais 'Il est allé'.", start: 35, duration: 4 },
      {
        text: "DR MRS VANDERTRAMP aide à mémoriser les verbes avec 'être'.",
        start: 39,
        duration: 5,
      },
    ],
    questions: [
      {
        question: "Comment forme-t-on le passé composé?",
        type: "multiple_choice",
        options: [
          "Avec un participe seulement",
          "Avec un auxiliaire et un participe passé",
          "Avec l'imparfait",
          "Avec le futur",
        ],
        correctAnswer: "Avec un auxiliaire et un participe passé",
        timestamp: 4,
      },
      {
        question:
          "Quel auxiliaire utilise-t-on avec les verbes de mouvement?",
        type: "multiple_choice",
        options: ["Avoir", "Être", "Faire", "Aller"],
        correctAnswer: "Être",
        timestamp: 16,
      },
      {
        question: "Avec 'être', que fait le participe passé?",
        type: "multiple_choice",
        options: [
          "Il reste invariable",
          "Il s'accorde avec le sujet",
          "Il s'accorde avec l'objet",
          "Il change de temps",
        ],
        correctAnswer: "Il s'accorde avec le sujet",
        timestamp: 30,
      },
    ],
  },
];

// ============================================
// VALIDATION HELPERS
// ============================================

export function validateVideo(
  video: VideoData,
  index: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const prefix = `Video ${index + 1} (${video.videoId})`;

  // Required fields
  if (!video.videoId?.trim()) {
    errors.push(`${prefix}: videoId is required`);
  }
  if (!video.title?.trim()) {
    errors.push(`${prefix}: title is required`);
  }
  if (!video.description?.trim()) {
    errors.push(`${prefix}: description is required`);
  }
  if (!["japanese", "english", "french"].includes(video.language)) {
    errors.push(
      `${prefix}: language must be "japanese", "english", or "french" (got "${video.language}")`
    );
  }
  if (!video.level?.trim()) {
    errors.push(`${prefix}: level is required (e.g., N5, A1, B2)`);
  }
  if (typeof video.duration !== "number" || video.duration <= 0) {
    errors.push(`${prefix}: duration must be a positive number in seconds`);
  }

  // Transcript validation
  if (!Array.isArray(video.transcript) || video.transcript.length === 0) {
    errors.push(`${prefix}: transcript must be a non-empty array`);
  } else {
    video.transcript.forEach((seg, segIndex) => {
      if (!seg.text?.trim()) {
        errors.push(
          `${prefix}: transcript segment ${segIndex + 1} has empty text`
        );
      }
      if (typeof seg.start !== "number" || seg.start < 0) {
        errors.push(
          `${prefix}: transcript segment ${segIndex + 1} has invalid start time`
        );
      }
      if (typeof seg.duration !== "number" || seg.duration <= 0) {
        errors.push(
          `${prefix}: transcript segment ${segIndex + 1} has invalid duration`
        );
      }
    });
  }

  // Questions validation
  if (!Array.isArray(video.questions) || video.questions.length < 3) {
    errors.push(
      `${prefix}: questions must have at least 3 items (got ${video.questions?.length || 0})`
    );
  } else {
    video.questions.forEach((q, qIndex) => {
      if (!q.question?.trim()) {
        errors.push(`${prefix}: question ${qIndex + 1} has empty question text`);
      }
      if (q.type !== "multiple_choice") {
        errors.push(
          `${prefix}: question ${qIndex + 1} must be type "multiple_choice"`
        );
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(
          `${prefix}: question ${qIndex + 1} must have at least 2 options`
        );
      }
      if (!q.correctAnswer || !q.options?.includes(q.correctAnswer)) {
        errors.push(
          `${prefix}: question ${qIndex + 1} correctAnswer must be one of the options`
        );
      }
    });
  }

  // Level validation based on language
  if (video.language === "japanese") {
    if (!["N5", "N4", "N3", "N2", "N1"].includes(video.level)) {
      errors.push(
        `${prefix}: Japanese level should be N5, N4, N3, N2, or N1 (got "${video.level}")`
      );
    }
  } else if (video.language) {
    if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(video.level)) {
      errors.push(
        `${prefix}: ${video.language} level should be A1-C2 (got "${video.level}")`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a string is a valid YouTube video ID (11 characters)
 */
export function isValidYoutubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Get thumbnail URL for a video
 */
export function getThumbnailUrl(video: VideoData): string {
  if (isValidYoutubeId(video.videoId)) {
    return `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
  }
  // Demo video - return empty string (UI will show language placeholder)
  return "";
}
