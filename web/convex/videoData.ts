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
  // JAPANESE VIDEOS
  // ============================================

  // REAL YOUTUBE VIDEO - んです grammar explanation
  {
    videoId: "SblaSl7ZVY0",
    language: "japanese",
    level: "N4",
    title: "How to Use んです (のです) - Japanese Grammar",
    description:
      "Learn how to use んです naturally in Japanese. Covers explaining situations, asking questions, and the casual forms.",
    duration: 700,
    transcript: [
      { text: "What is this んです? Why don't you just say...", start: 0, duration: 8 },
      { text: "What is the difference between these sentences?", start: 8, duration: 5 },
      { text: "This んです is used when you are explaining something that you want to tell or the other person doesn't know.", start: 13, duration: 10 },
      { text: "When I say 日本人なんです, I say it as if you don't know that I'm Japanese.", start: 23, duration: 10 },
      { text: "If I say 本なんです, I'm saying this as if you don't know that this is a book. I'm explaining something that you don't know.", start: 33, duration: 14 },
      { text: "There are basically three situations where you use this んです.", start: 47, duration: 6 },
      { text: "The first one is when you are explaining something that the other person doesn't know.", start: 53, duration: 7 },
      { text: "The second situation is when you are explaining a circumstance to clarify a situation.", start: 60, duration: 8 },
      { text: "For example, say I'm walking on the street with my little sister and we bumped into my co-worker.", start: 68, duration: 10 },
      { text: "My co-worker saw us talking intimately so that person thought we were a couple.", start: 78, duration: 10 },
      { text: "And I knew that my co-worker has a wrong idea so I use this んです to explain.", start: 88, duration: 10 },
      { text: "彼女じゃないんです - Actually, she's not my girlfriend.", start: 98, duration: 8 },
      { text: "妹なんです - Actually, she's my little sister.", start: 106, duration: 8 },
      { text: "This んです has similar feeling to this English word 'actually'.", start: 114, duration: 8 },
      { text: "If I just say 彼女じゃないです、妹です, then it is like 'she's not my girlfriend, she's my little sister' - do you see the difference?", start: 122, duration: 15 },
      { text: "Imagine a situation where I'm crying. You saw me crying and you might ask me 'hey what's wrong?'", start: 137, duration: 13 },
      { text: "When you ask me what's wrong, I'll explain what happens. So I'm explaining the situation right now.", start: 150, duration: 10 },
      { text: "In this case I will say something like 〜んです. I use んです to explain the situation to you.", start: 160, duration: 12 },
      { text: "So the second situation you use んです is to clarify a situation, to explain a circumstance.", start: 172, duration: 10 },
      { text: "The third situation where you use this んです is when you confess something.", start: 182, duration: 8 },
      { text: "Or when you tell someone something that you have never told that person before.", start: 190, duration: 8 },
      { text: "For example: I haven't told you before... 吸血鬼なんです - actually I'm a vampire.", start: 198, duration: 12 },
      { text: "If I say 吸血鬼です, it's just introducing yourself: 'hi I'm a vampire'.", start: 210, duration: 8 },
      { text: "But 吸血鬼なんです is like 'I haven't told you this, actually I'm a vampire'.", start: 218, duration: 10 },
      { text: "This んです is often used when you tell someone that you like them for the first time.", start: 228, duration: 10 },
      { text: "好きなんです - 'actually I like you' or 'you may not know, I like you'.", start: 238, duration: 10 },
      { text: "んですか is also used when you ask questions. It has a feeling of 'I want to know' or 'would you explain'.", start: 248, duration: 12 },
      { text: "It is used when you seek explanation from someone. Let's compare these two sentences.", start: 260, duration: 10 },
      { text: "何をしていますか - I'm just asking 'what are you doing?'", start: 270, duration: 8 },
      { text: "何をしているんですか - As if I'm saying in English 'hey what ARE you doing?'", start: 278, duration: 10 },
      { text: "When I say 何をしているんですか, it has a feeling of 'hey I want to know' or 'would you explain what are you doing?'", start: 288, duration: 12 },
      { text: "When you make a phone call and ask your friend 'hey what's up? what are you doing now?' - you just say 何をしていますか.", start: 300, duration: 12 },
      { text: "You wouldn't say 何をしているんですか because it sounds like 'hey what ARE you doing' - as if they've done something wrong.", start: 312, duration: 15 },
      { text: "If I see someone breaking into my car, I would say 何をしているんですか - like in English 'hey what are you doing!'", start: 327, duration: 15 },
      { text: "Because I'm seeking explanation from this person - 'hey what are you doing?'", start: 342, duration: 10 },
      { text: "You can also ask questions like 'what is one plus one?' - you don't ask this question to know the answer, right?", start: 352, duration: 12 },
      { text: "But if I say 一足す一は何なんですか, I'm saying this as if I'm seeking explanation.", start: 364, duration: 12 },
      { text: "If I bump into you on the street and ask 'where are you going?' - I would say どこに行くんですか.", start: 376, duration: 12 },
      { text: "This adds a feeling like 'would you tell me' or 'I want to know'.", start: 388, duration: 10 },
      { text: "There is also another situation where you use んですか to ask questions.", start: 398, duration: 8 },
      { text: "You use this when you are surprised or something you didn't expect happened.", start: 406, duration: 10 },
      { text: "For example, I'm eating lunch with you and you suddenly picked a spider and ate it. I'm surprised!", start: 416, duration: 12 },
      { text: "I will say 蜘蛛食べたんですか - 'did you just eat spider?' with a surprised feeling.", start: 428, duration: 12 },
      { text: "When a friend came over and you want them to go home but feel uncomfortable saying it directly...", start: 440, duration: 12 },
      { text: "When this person finally says 'I'm going home now', you might say 帰るんですか? - 'oh you're going home?' as if surprised.", start: 452, duration: 15 },
      { text: "This んです is polite form. When you want to say it in casual form, you would say の or なんだ.", start: 467, duration: 12 },
      { text: "日本人なんです (polite) becomes 日本人なの or 日本人なんだ (casual).", start: 479, duration: 10 },
      { text: "But の is usually used by women and なんだ is usually used by men.", start: 489, duration: 10 },
      { text: "When you ask questions, you cannot use んだ. You would just say の - both men and women use の when asking questions.", start: 499, duration: 15 },
      { text: "One more thing - we use んです before we ask a question or ask for a favor to clarify the situation.", start: 514, duration: 12 },
      { text: "For example, I'm lost. I don't know how to get to the station.", start: 526, duration: 8 },
      { text: "I don't just start by asking 'how to get to the station?' - I might say 'I'm sorry, I'm lost...'", start: 534, duration: 12 },
      { text: "道に迷ったんですが、駅はどこですか - 'I'm lost (explaining situation), where is the station?'", start: 546, duration: 12 },
      { text: "To clarify the situation I'm in, I use んですが before asking the question.", start: 558, duration: 10 },
      { text: "For example, if I want to ask about the best ramen place: 札幌でラーメンを食べるのを楽しみにしてたんですが...", start: 568, duration: 15 },
      { text: "'I've been looking forward to eating ramen in Sapporo' - clarifying my situation before asking.", start: 583, duration: 12 },
      { text: "One thing you should remember: many Japanese people use んですが before they ask questions or ask for a favor.", start: 595, duration: 15 },
    ],
    questions: [
      {
        question: "What is the main function of んです in Japanese?",
        type: "multiple_choice",
        options: [
          "To make sentences more polite",
          "To explain something the listener doesn't know",
          "To ask questions",
          "To express future tense",
        ],
        correctAnswer: "To explain something the listener doesn't know",
        timestamp: 13,
      },
      {
        question: "What English word has a similar feeling to んです?",
        type: "multiple_choice",
        options: ["Maybe", "Actually", "However", "Therefore"],
        correctAnswer: "Actually",
        timestamp: 114,
      },
      {
        question: "When asking questions with んですか, what feeling does it convey?",
        type: "multiple_choice",
        options: [
          "Casual and friendly",
          "Seeking explanation / 'I want to know'",
          "Anger and frustration",
          "Formal business tone",
        ],
        correctAnswer: "Seeking explanation / 'I want to know'",
        timestamp: 248,
      },
      {
        question: "What is the casual form of んです for men?",
        type: "multiple_choice",
        options: ["なの", "なんだ", "です", "だよ"],
        correctAnswer: "なんだ",
        timestamp: 479,
      },
      {
        question: "Why do Japanese speakers often use んですが before asking questions?",
        type: "multiple_choice",
        options: [
          "To be more casual",
          "To clarify their situation before the request",
          "To show they are in a hurry",
          "To express doubt",
        ],
        correctAnswer: "To clarify their situation before the request",
        timestamp: 558,
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
