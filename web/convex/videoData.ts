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
      {
        text: "This んです is used when you are explaining something that you want to tell or the other person doesn't know.",
        start: 13,
        duration: 10,
      },
      {
        text: "When I say 日本人なんです, I say it as if you don't know that I'm Japanese.",
        start: 23,
        duration: 10,
      },
      {
        text: "If I say 本なんです, I'm saying this as if you don't know that this is a book. I'm explaining something that you don't know.",
        start: 33,
        duration: 14,
      },
      {
        text: "There are basically three situations where you use this んです.",
        start: 47,
        duration: 6,
      },
      {
        text: "The first one is when you are explaining something that the other person doesn't know.",
        start: 53,
        duration: 7,
      },
      {
        text: "The second situation is when you are explaining a circumstance to clarify a situation.",
        start: 60,
        duration: 8,
      },
      {
        text: "For example, say I'm walking on the street with my little sister and we bumped into my co-worker.",
        start: 68,
        duration: 10,
      },
      {
        text: "My co-worker saw us talking intimately so that person thought we were a couple.",
        start: 78,
        duration: 10,
      },
      {
        text: "And I knew that my co-worker has a wrong idea so I use this んです to explain.",
        start: 88,
        duration: 10,
      },
      { text: "彼女じゃないんです - Actually, she's not my girlfriend.", start: 98, duration: 8 },
      { text: "妹なんです - Actually, she's my little sister.", start: 106, duration: 8 },
      {
        text: "This んです has similar feeling to this English word 'actually'.",
        start: 114,
        duration: 8,
      },
      {
        text: "If I just say 彼女じゃないです、妹です, then it is like 'she's not my girlfriend, she's my little sister' - do you see the difference?",
        start: 122,
        duration: 15,
      },
      {
        text: "Imagine a situation where I'm crying. You saw me crying and you might ask me 'hey what's wrong?'",
        start: 137,
        duration: 13,
      },
      {
        text: "When you ask me what's wrong, I'll explain what happens. So I'm explaining the situation right now.",
        start: 150,
        duration: 10,
      },
      {
        text: "In this case I will say something like 〜んです. I use んです to explain the situation to you.",
        start: 160,
        duration: 12,
      },
      {
        text: "So the second situation you use んです is to clarify a situation, to explain a circumstance.",
        start: 172,
        duration: 10,
      },
      {
        text: "The third situation where you use this んです is when you confess something.",
        start: 182,
        duration: 8,
      },
      {
        text: "Or when you tell someone something that you have never told that person before.",
        start: 190,
        duration: 8,
      },
      {
        text: "For example: I haven't told you before... 吸血鬼なんです - actually I'm a vampire.",
        start: 198,
        duration: 12,
      },
      {
        text: "If I say 吸血鬼です, it's just introducing yourself: 'hi I'm a vampire'.",
        start: 210,
        duration: 8,
      },
      {
        text: "But 吸血鬼なんです is like 'I haven't told you this, actually I'm a vampire'.",
        start: 218,
        duration: 10,
      },
      {
        text: "This んです is often used when you tell someone that you like them for the first time.",
        start: 228,
        duration: 10,
      },
      {
        text: "好きなんです - 'actually I like you' or 'you may not know, I like you'.",
        start: 238,
        duration: 10,
      },
      {
        text: "んですか is also used when you ask questions. It has a feeling of 'I want to know' or 'would you explain'.",
        start: 248,
        duration: 12,
      },
      {
        text: "It is used when you seek explanation from someone. Let's compare these two sentences.",
        start: 260,
        duration: 10,
      },
      { text: "何をしていますか - I'm just asking 'what are you doing?'", start: 270, duration: 8 },
      {
        text: "何をしているんですか - As if I'm saying in English 'hey what ARE you doing?'",
        start: 278,
        duration: 10,
      },
      {
        text: "When I say 何をしているんですか, it has a feeling of 'hey I want to know' or 'would you explain what are you doing?'",
        start: 288,
        duration: 12,
      },
      {
        text: "When you make a phone call and ask your friend 'hey what's up? what are you doing now?' - you just say 何をしていますか.",
        start: 300,
        duration: 12,
      },
      {
        text: "You wouldn't say 何をしているんですか because it sounds like 'hey what ARE you doing' - as if they've done something wrong.",
        start: 312,
        duration: 15,
      },
      {
        text: "If I see someone breaking into my car, I would say 何をしているんですか - like in English 'hey what are you doing!'",
        start: 327,
        duration: 15,
      },
      {
        text: "Because I'm seeking explanation from this person - 'hey what are you doing?'",
        start: 342,
        duration: 10,
      },
      {
        text: "You can also ask questions like 'what is one plus one?' - you don't ask this question to know the answer, right?",
        start: 352,
        duration: 12,
      },
      {
        text: "But if I say 一足す一は何なんですか, I'm saying this as if I'm seeking explanation.",
        start: 364,
        duration: 12,
      },
      {
        text: "If I bump into you on the street and ask 'where are you going?' - I would say どこに行くんですか.",
        start: 376,
        duration: 12,
      },
      {
        text: "This adds a feeling like 'would you tell me' or 'I want to know'.",
        start: 388,
        duration: 10,
      },
      {
        text: "There is also another situation where you use んですか to ask questions.",
        start: 398,
        duration: 8,
      },
      {
        text: "You use this when you are surprised or something you didn't expect happened.",
        start: 406,
        duration: 10,
      },
      {
        text: "For example, I'm eating lunch with you and you suddenly picked a spider and ate it. I'm surprised!",
        start: 416,
        duration: 12,
      },
      {
        text: "I will say 蜘蛛食べたんですか - 'did you just eat spider?' with a surprised feeling.",
        start: 428,
        duration: 12,
      },
      {
        text: "When a friend came over and you want them to go home but feel uncomfortable saying it directly...",
        start: 440,
        duration: 12,
      },
      {
        text: "When this person finally says 'I'm going home now', you might say 帰るんですか? - 'oh you're going home?' as if surprised.",
        start: 452,
        duration: 15,
      },
      {
        text: "This んです is polite form. When you want to say it in casual form, you would say の or なんだ.",
        start: 467,
        duration: 12,
      },
      {
        text: "日本人なんです (polite) becomes 日本人なの or 日本人なんだ (casual).",
        start: 479,
        duration: 10,
      },
      {
        text: "But の is usually used by women and なんだ is usually used by men.",
        start: 489,
        duration: 10,
      },
      {
        text: "When you ask questions, you cannot use んだ. You would just say の - both men and women use の when asking questions.",
        start: 499,
        duration: 15,
      },
      {
        text: "One more thing - we use んです before we ask a question or ask for a favor to clarify the situation.",
        start: 514,
        duration: 12,
      },
      {
        text: "For example, I'm lost. I don't know how to get to the station.",
        start: 526,
        duration: 8,
      },
      {
        text: "I don't just start by asking 'how to get to the station?' - I might say 'I'm sorry, I'm lost...'",
        start: 534,
        duration: 12,
      },
      {
        text: "道に迷ったんですが、駅はどこですか - 'I'm lost (explaining situation), where is the station?'",
        start: 546,
        duration: 12,
      },
      {
        text: "To clarify the situation I'm in, I use んですが before asking the question.",
        start: 558,
        duration: 10,
      },
      {
        text: "For example, if I want to ask about the best ramen place: 札幌でラーメンを食べるのを楽しみにしてたんですが...",
        start: 568,
        duration: 15,
      },
      {
        text: "'I've been looking forward to eating ramen in Sapporo' - clarifying my situation before asking.",
        start: 583,
        duration: 12,
      },
      {
        text: "One thing you should remember: many Japanese people use んですが before they ask questions or ask for a favor.",
        start: 595,
        duration: 15,
      },
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

  // REAL YOUTUBE VIDEO - Why Introductions Are So Important in Japan
  {
    videoId: "4ioXopIO8OQ",
    language: "japanese",
    level: "N4",
    title: "Why Introductions Are So Important in Japan",
    description: "Video by Karen Shidahara",
    duration: 544,
    transcript: [
      {
        text: "やっぱり自己紹介って自分のこともそうですし、相手のこともよく知るための第1歩になるので、とても大切だと思っています。",
        start: 0,
        duration: 14,
      },
      {
        text: "こんにちは。カレンです。元気ですか?私このお仕事をしててびっくりされるんですけど、こう見えてすっごい上がり症なんですよ。",
        start: 14,
        duration: 14,
      },
      {
        text: "だからたくさんいる人の前で喋るのめちゃくちゃ苦手です。もうめすっごい緊張しちゃって、もうなんか言うこともも全部ふ吹っ飛んじゃうぐらいすごい上がり症で緊張するので初めて会う人もすごく実は緊張してドキドキしてるんですよね。",
        start: 28,
        duration: 22,
      },
      {
        text: "なのでこう私の名前を言う時とかこう自己紹介をする時多分色々間違えちゃってるんですよ。",
        start: 50,
        duration: 5,
      },
      {
        text: "初めましてカレンです。よろしくお願いします。私今20何歳なんですけどっていう年齢が間違えてたりするんですよ。",
        start: 55,
        duration: 9,
      },
      {
        text: "これ本当に昔からですごくなんかあ、頑張らなきゃな、直さなきゃなっていうのがどんどん空回りしてって、あの良くない方向に行っちゃうんですけれども、今日は日本での自己紹介についてすることはしないことというのを紹介していきたいと思います。",
        start: 64,
        duration: 25,
      },
      {
        text: "友達の紹介だと初めましてカレンです。よろしくお願いしますが、よく使うフレーズになります。ま、結構柔らかい感じの、えっと、文章で、あとは笑顔でっていうのが基本的なスタイルです。",
        start: 89,
        duration: 16,
      },
      {
        text: "初対面でもこう先輩後輩の関係っていうのはもによることが多いんですけれども、でもカジュアルな自己紹介、友達と友達の間だと割と高確率であの先輩後輩の関係っていうのはないことが多いです。",
        start: 105,
        duration: 17,
      },
      {
        text: "私はあの夫が同い年なんですよ。で、夫の友達も基本的に同い年じゃないですか。なので、その夫の友達の奥さんも私は同い年だと思ってしまって勘違いしてて、ずっとあのカジュアルな話し方をしてたんですよね。",
        start: 122,
        duration: 28,
      },
      {
        text: "で、ふと、え、年いくつって聞いたら全然私より年上だったんですよ。で、すごい謝りました。",
        start: 150,
        duration: 9,
      },
      {
        text: "その時に本当にごめんなさいって言って、私が基本的には結構年上の方にこうカジュアルな話し方をするのが好きではないので苦手好きではない。あの、できれば丁寧な敬語を使って丁寧に話をしていきたい人なので、その時すごく謝りました。",
        start: 159,
        duration: 19,
      },
      {
        text: "よく話すトピックスとしては結構やっぱ出身地とかあと趣味とか年齢も結構言いますね。カジュアルな部分だと年齢も気になることが多いので言うし聞くことが多いです。",
        start: 178,
        duration: 18,
      },
      {
        text: "最近私が初めてお話しした方で言うと子供の子遊び場に連れて行った時にいるお母さんだったんですけどもその方もお子さんと一緒に来ていて",
        start: 196,
        duration: 18,
      },
      {
        text: "で、その時にあ、初めましてみたいな感じで話をしたんですけれども、やっぱりあの子供の年齢とか一緒に遊ぶとなると子供の年齢が同じぐらいだとやっぱりお母さん同士も安心して遊ばせてあげれるので子供の年齢をやっぱ聞きますね。",
        start: 214,
        duration: 25,
      },
      {
        text: "あとは幼稚園の話幼稚園どこ行きますかとかご飯何食べますかとかお家で何食べさせてますかっていう話は結構します。",
        start: 239,
        duration: 15,
      },
      {
        text: "カジュアルな自己紹介では例えばお友達だったりとか幼稚園のママ友だったりとかそういった方には初めましてカレンです。よろしくねとかこういった軽い文章カジュアルな文章になっていて",
        start: 254,
        duration: 15,
      },
      {
        text: "逆にえっと社会人に出て初めての職場でみんなの前で自己紹介をする時は初めまして原カレンと申します。どうぞよろしくお願いします。よろしくお願いいたしますのような丁寧な文章になります。",
        start: 269,
        duration: 17,
      },
      {
        text: "名刺を交換する時にもいくつかルールがあって、これは最初からこう職場の方から教えてもらったりとか、あとは自分が社会人になるタイミングでネットで調べたりしました。",
        start: 286,
        duration: 17,
      },
      {
        text: "で、こう名刺を交換する時は基本的にこう両手で受け取る、受け取った後にすぐにポッケにはしまわないんですよ。こうお話する相手が目の前にいると机の上にこう置いておく。置いておいて話を続けるというのがマナーになります。",
        start: 303,
        duration: 21,
      },
      {
        text: "ズーム会議だと結構こう画面にここの上からでしか収まっていないことがあって結構立ったり座ったりもないですしあまりこう色々動きが見えないので見えないんですけれどもお辞儀をしたりとかこう手でジェスチャーをしたりとかはすごく大事になります。",
        start: 324,
        duration: 25,
      },
      {
        text: "日本では初めましてという言葉は本当に初めてあったその時しか使わないんですよ。なので最後の最後に初めましてでしたのような日本語は使わないです。",
        start: 349,
        duration: 15,
      },
      {
        text: "またね、じゃあねはカジュアルな場面で使うんですけれどもフォーマルな場面だとありがとうございましたやこれからもよろしくお願いしますというのが自然です。",
        start: 364,
        duration: 13,
      },
      {
        text: "こういったマナーは私は高校受験をする時に面接練習があったんですけれども、その時に先生から教わった記憶があります。あとは初めて自分が社会人になる時だったりとかに会社の上司からマナーとして教えていただいたりとか自分でネットで調べて勉強しました。",
        start: 377,
        duration: 29,
      },
      {
        text: "私は困らないように教えたいと思ってます。やっぱり特に大切だと思うのが目を見て会話をするっていうところが大切だなと思っています。",
        start: 406,
        duration: 12,
      },
      {
        text: "このマナーの勉強でもやっぱり目を見るのが恥ずかしかったりとかすごく緊張してしまう人っているのでそういう方はマナーを教えていただいてる時に目じゃなくて男性だったらここのネクタイの部分を見なさいとかそういったちょっとしたコツとかもマナーの中にはあります。",
        start: 418,
        duration: 25,
      },
      {
        text: "で、そういったコツとかも教えていただいたので、そういうのはなるべくね、社会人になる前に、そして、あの、社会人になる前じゃなくてもやっぱりこう集団生活をしていく部分では小学校幼稚園の時から大切な部分になってくると思うので教えていきたいです。",
        start: 443,
        duration: 20,
      },
      {
        text: "皆さん見ていただきありがとうございました。今日は日本での自己紹介よくすることまたはしないことというテーマでお話をしたんですけれどもいかがでしたか?",
        start: 463,
        duration: 13,
      },
      {
        text: "やっぱり自己紹介って自分のこともそうですし、相手のこともよく知るための第1歩になるのでとても大切だと思っています。",
        start: 476,
        duration: 11,
      },
      {
        text: "こう、自己紹介の印象がいいとその後の印象もよ、良くなるというか、これからもっと仲良くしていきたいなという思いにつがるので、是非ね、日本での自己紹介も勉強してみてください。",
        start: 487,
        duration: 18,
      },
      {
        text: "もう皆さんは私のこと結構知ってるんじゃないですか?やっぱり自己紹介動画とかがね、あるので、それを見て知ってくださってる方は多いと思います。",
        start: 505,
        duration: 8,
      },
      {
        text: "私も皆さんのことを知りたいので、是非コメント欄にいて教えてください。やっぱり名前とか出身地とか趣味とか色々教えていただけたら嬉しいです。",
        start: 513,
        duration: 14,
      },
      {
        text: "そして今日の動画が役に立ったりもっと日本語を勉強したいなと思った方はいいねとチャンネル登録を是非よろしくお願いします。",
        start: 527,
        duration: 14,
      },
      {
        text: "日本語はたくさん聞くことで自然と身についてきます。これからも私の日本語リラックスして楽しんでくださいね。それじゃあバイバイ。",
        start: 541,
        duration: 3,
      },
    ],
    questions: [
      {
        question: "カレンさんが仕事で緊張したとき、どうなってしまうと言っていますか？",
        type: "multiple_choice",
        options: ["泣いてしまう", "言うことを忘れてしまう", "怒り出してしまう", "寝てしまう"],
        correctAnswer: "言うことを忘れてしまう",
        timestamp: 25,
      },
      {
        question: "ビジネスで名刺を受け取るとき、どのようなマナーが必要ですか？",
        type: "multiple_choice",
        options: [
          "すぐにポケットにしまう",
          "片手で受け取る",
          "両手で受け取って机に置く",
          "名刺にメモを書く",
        ],
        correctAnswer: "両手で受け取って机に置く",
        timestamp: 255,
      },
      {
        question: "カレンさんが夫の友達の奥さんと話したとき、どんな失敗をしましたか？",
        type: "multiple_choice",
        options: [
          "名前を間違えた",
          "年上だと知らずカジュアルに話した",
          "敬語を使いすぎた",
          "話題が見つからなかった",
        ],
        correctAnswer: "年上だと知らずカジュアルに話した",
        timestamp: 135,
      },
    ],
  },

  // REAL YOUTUBE VIDEO - Japanese Pronunciation: Rhythm
  {
    videoId: "J_HLY0Rss-g",
    language: "japanese",
    level: "N5",
    title: "Japanese Pronunciation: Rhythm",
    description: "Video by Kaname Naito",
    duration: 415,
    transcript: [
      { text: "McDonald's hamburger hamburger interesting or interesting", start: 0, duration: 17 },
      {
        text: "today I'd like to talk about how Japanese people conceptualize sounds",
        start: 17,
        duration: 6,
      },
      {
        text: "understanding how Japanese people recognize and conceptualize sound is very important to speak Japanese with proper Rhythm and accent",
        start: 23,
        duration: 8,
      },
      {
        text: "also it helps you to recognize sounds when you are listening to Japanese",
        start: 31,
        duration: 7,
      },
      {
        text: "so how Japanese people recognize sounds they grasp sounds using sound the unit code Mora in Japanese it is called Haku",
        start: 38,
        duration: 11,
      },
      {
        text: "Haku also means beat in music Every Beat has the same length",
        start: 49,
        duration: 8,
      },
      { text: "just like Mora in Japanese language so when I say", start: 57, duration: 10 },
      {
        text: "every mora in this taxi knowledge is supposed to be equally long even though there are some exceptions in real life conversation",
        start: 67,
        duration: 9,
      },
      {
        text: "but basically you should pronounce every mora equally long in Japanese we basically use Mora instead of syllables",
        start: 76,
        duration: 9,
      },
      {
        text: "what's the difference between mora and syllables for example hamburger in Japanese is",
        start: 85,
        duration: 13,
      },
      {
        text: "well when you say hambaga Han Han is supposed to be one syllable but if you're talking about Mora ha is two moras",
        start: 98,
        duration: 15,
      },
      { text: "also has two moras ga has two moras", start: 113, duration: 10 },
      { text: "in Japanese is supposed to have six moras", start: 123, duration: 5 },
      {
        text: "if you don't have the concept of Mora say to Japanese people's ears it sounds a little bit weird because you don't pronounce ham long enough supposed to have two moras",
        start: 128,
        duration: 19,
      },
      {
        text: "there are three kinds of sounds you should note one is long vowel long vowel is just like you extend the vowel for one more",
        start: 147,
        duration: 14,
      },
      {
        text: "if I just say ba ba it is but if I say ba ba it has two moras it's the same when I say",
        start: 161,
        duration: 17,
      },
      {
        text: "because this vowel is extended for one more instead of saying I say Gaga",
        start: 178,
        duration: 7,
      },
      {
        text: "so it has to moras you should be careful that when you're saying long vowel you should pronounce it for two moras in length",
        start: 185,
        duration: 11,
      },
      {
        text: "it often confuses Japanese people when foreigners pronounce long vowel not long enough for example word like ojisan ojisa means Grandpa",
        start: 196,
        duration: 15,
      },
      {
        text: "G is a long vowel so you should extend another one more to pronounce it",
        start: 211,
        duration: 7,
      },
      {
        text: "but many Foreigner when they're pronouncing this word they hastily say it sounds like different word autism means Uncle it's not grandpa",
        start: 218,
        duration: 12,
      },
      {
        text: "so when you're saying this word you should extend D long enough so it sounds like Grandpa not uncle",
        start: 230,
        duration: 14,
      },
      {
        text: "the second one is sound can be pronounced as um I will cover this sound in different video",
        start: 244,
        duration: 9,
      },
      {
        text: "well for example what like has four moras foreign Learners often pronounce the syllable Khan as one more instead of two therefore it sounds too fast to Japanese ears",
        start: 253,
        duration: 16,
      },
      { text: "many foreigners say Kan tan like instead of saying", start: 269, duration: 17 },
      {
        text: "so you should remember that sound takes up the same length as any other sound",
        start: 286,
        duration: 6,
      },
      {
        text: "the last one is sound called sokun sokun is a sound of holding consonant longer something similar to glottal stuff like Saka",
        start: 292,
        duration: 11,
      },
      {
        text: "suck is instead of just saying Saka Saka well Saka has two moras but if I say has three moras",
        start: 303,
        duration: 14,
      },
      {
        text: "this topping part in the middle is called sokun so this is how Japanese people recognize sounds",
        start: 317,
        duration: 8,
      },
      {
        text: "when they hear some English words like computer they convert it into moras computer in Japanese is computer",
        start: 325,
        duration: 13,
      },
      {
        text: "so they convert it into KO um pew uh ah long vowel computer so it has six moras",
        start: 338,
        duration: 11,
      },
      {
        text: "when they hear English word like interesting interesting Japanese people convert the sound into moras",
        start: 349,
        duration: 12,
      },
      {
        text: "so interesting will be um so it has in total of eight moras",
        start: 361,
        duration: 12,
      },
      {
        text: "this is one of the reasons why Japanese pronunciation of some English words sounds funny they have different Rhythm",
        start: 373,
        duration: 8,
      },
      {
        text: "that's also why Japanese people generally have trouble learning English if your mother tongue is Japanese then you have this mora system installed in your sound recognition system",
        start: 381,
        duration: 14,
      },
      {
        text: "installing a new sound recognition system is not an easy task so for Japanese people learning English is a very difficult thing",
        start: 395,
        duration: 8,
      },
      {
        text: "the same thing can be said if your mother tongue is English because you have different sound recognition system installed in your head",
        start: 403,
        duration: 9,
      },
      {
        text: "so you would have some trouble listening to or speaking Japanese in the next video I'll prepare some exercises so you can get used to Japanese mora system",
        start: 412,
        duration: 3,
      },
    ],
    questions: [
      {
        question: "日本語の「はく（Haku）」は、音楽の何と同じだと言っていますか？",
        type: "multiple_choice",
        options: ["メロディー", "リズム（ビート）", "ピアノ", "うた"],
        correctAnswer: "リズム（ビート）",
        timestamp: 50,
      },
      {
        question: "「おじいさん」と「おじさん」の違いは何ですか？",
        type: "multiple_choice",
        options: ["声の大きさ", "はなすスピード", "「い」の長さ", "ことばの意味"],
        correctAnswer: "「い」の長さ",
        timestamp: 150,
      },
      {
        question: "「かんたん」という言葉には、いくつの「はく（モラ）」がありますか？",
        type: "multiple_choice",
        options: ["2", "3", "4", "5"],
        correctAnswer: "4",
        timestamp: 200,
      },
    ],
  },

  // REAL YOUTUBE VIDEO - いいえ Is Lame
  {
    videoId: "s2XLodV2pW8",
    language: "japanese",
    level: "N4",
    title: "いいえ Is Lame",
    description: "Video by Kaname Naito",
    duration: 391,
    transcript: [
      {
        text: "かめ at the very first stage of your Japanese learning experience you might have learned",
        start: 0,
        duration: 6,
      },
      {
        text: "いいえ あなたは日本人ですか いいえ 私は日本人ではありません",
        start: 6,
        duration: 9,
      },
      {
        text: "in real life people rarely say いいえ to say no just too long three moras and you extend another え え",
        start: 15,
        duration: 15,
      },
      {
        text: "say in life Japanese people say いや or や instead of いいえ",
        start: 30,
        duration: 10,
      },
      {
        text: "basically if not in very formal occasion you just use いや even when you are talking in polite form",
        start: 40,
        duration: 10,
      },
      {
        text: "もしもし すいません こちらは田中さんの携帯でしょうか いや 違います",
        start: 50,
        duration: 8,
      },
      {
        text: "田中さん 普段スポーツとかやってるんですか いや 僕はやらないですね 佐藤さんは何かやってるんですか",
        start: 58,
        duration: 7,
      },
      {
        text: "いや 実は僕も何もやってないんですよ でもこれから何か始めようかなと思って",
        start: 65,
        duration: 7,
      },
      {
        text: "田中さん もしよかったら一緒にバドミントンでもやりませんか いや いいですよ 僕最近あまり時間に余裕がないんで",
        start: 72,
        duration: 11,
      },
      {
        text: "Actually you even have to pronounce え in いえ you can just say や や",
        start: 83,
        duration: 7,
      },
      {
        text: "会員カードはございますか いや ないです お作りいたしますか いや 結構です",
        start: 90,
        duration: 7,
      },
      {
        text: "クーポンはお持ちでしょうか いや ないです 駐車券はございますか いや ないです",
        start: 97,
        duration: 7,
      },
      { text: "紙袋はお使いでしょうか いや 大丈夫です", start: 104, duration: 3 },
      {
        text: "even though it is written いや but when people pronounce it people often pronounce it with one mora so they just say や や",
        start: 107,
        duration: 13,
      },
      {
        text: "because anyway when you say や や you have to say this very short え at the begin",
        start: 120,
        duration: 11,
      },
      {
        text: "first to say so when people say in everyday conversation they say や in more every time",
        start: 131,
        duration: 7,
      },
      {
        text: "会員カードはお持ちですか いや ないです いや うん people would say ないです や や just one mora",
        start: 138,
        duration: 17,
      },
      {
        text: "ね 明日きに行こう や 行かない え なんで 一緒に行こう いや 行かない 私明日家でのんびりしたいもん",
        start: 155,
        duration: 12,
      },
      {
        text: "by way や is also used to say I don't want when people use to say I don't want to use auxiliary verb",
        start: 167,
        duration: 13,
      },
      {
        text: "ね 夜うちで麻雀やるんだけどメンバー1人足りないからあんたも来て やだ 俺今日は家でゆっくり1人で映画見たいし",
        start: 180,
        duration: 12,
      },
      {
        text: "え お願い 今度ラーメンを奢ってあげるから ラーメンじゃやだ 寿司ならいいよ え 寿司はやだ 高いもん",
        start: 192,
        duration: 9,
      },
      {
        text: "when people actually say やだ most of times they say やだ やだ in mora instead of mora",
        start: 201,
        duration: 11,
      },
      {
        text: "やだ やだ has a childish vibe it has a feeling of some kids rejecting to do something of some childish reason",
        start: 212,
        duration: 10,
      },
      {
        text: "コータ もう8時だよ そろそろゲームやめなさい やだ やだじゃなくてやめなさい やだ",
        start: 222,
        duration: 12,
      },
      {
        text: "あんた いい加減にしないとテレビの電源切るよ やだ やだ ゲームやりたい",
        start: 234,
        duration: 9,
      },
      {
        text: "by the way this usage やだ やだ やだ is called 駄々をこねる",
        start: 243,
        duration: 5,
      },
      {
        text: "駄々をこねる refers to an action of rejecting to accept something that you are supposed to accept because of some selfish reason",
        start: 248,
        duration: 10,
      },
      {
        text: "南 もう帰るよ やだ まだ帰りたくない やだじゃなくてもう遅いから帰るよ やだ まだ帰りたくない まだここで遊んでたい",
        start: 258,
        duration: 12,
      },
      {
        text: "あんたもう小学生でしょ 駄々こねるんじゃない あみちゃん見てごらん",
        start: 270,
        duration: 6,
      },
      {
        text: "ほれ あみちゃんまだ6歳で小学校にも行ってないのにちゃんとお母さんの言うことを聞いて今もう帰る準備してるでしょ",
        start: 276,
        duration: 10,
      },
      {
        text: "南はもう小学生なんだからちゃんとお母さんの言うこと聞きなさい はい いい子だね",
        start: 286,
        duration: 7,
      },
      {
        text: "Let get back to the main point of this video so people use いや much use いや to say no",
        start: 293,
        duration: 7,
      },
      {
        text: "when you want to say no you can just say いや や even when you are talking in polite form",
        start: 300,
        duration: 8,
      },
      {
        text: "but in some very formal occasion when you are required to say very politely then you say いいえ to say no instead of いや",
        start: 308,
        duration: 11,
      },
      {
        text: "for example in job interview 田中さんは英語が話せますか いえ 話せません ですが中国語なら多少できます",
        start: 319,
        duration: 11,
      },
      {
        text: "以前別の旅行会社に務めた経験は終わりですか いや ありません そうですか わかりました では面接は以上です 何か質問等はございますか いや 特にありません",
        start: 330,
        duration: 15,
      },
      { text: "just like いや people often say いえ in one mora like イ", start: 345, duration: 7 },
      {
        text: "フロントでございます あのすいませんここってwi-fiありますか いえ 当ホテルwi-fiはございません",
        start: 352,
        duration: 8,
      },
      {
        text: "その代わり各部屋にランケーブルの差し込み口がございまして優先でならインターネットに接続することができます あ そうですか 分かりました",
        start: 360,
        duration: 9,
      },
      {
        text: "あ ともう1つお聞きしたいんですが ホームページで見たんですがこちらのホテルにバーがありますよね バーって今空いてるんですか",
        start: 369,
        duration: 13,
      },
      {
        text: "いえ 大変申し訳ございませんがバーは現在新型コロナウイルス蔓延防止のためにクローズしております あ そうなんですか 分かりました",
        start: 382,
        duration: 6,
      },
      { text: "so from now on you spare say いや to say no", start: 388, duration: 3 },
    ],
    questions: [
      {
        question:
          "丁寧な会話（です・ます）で「いいえ」の代わりに何を使うことが多いと言っていますか？",
        type: "multiple_choice",
        options: ["はい", "いや", "いいよ", "だめ"],
        correctAnswer: "いや",
        timestamp: 25,
      },
      {
        question:
          "「やだ」という言葉を繰り返して使うと、どのような印象（ニュアンス）になりますか？",
        type: "multiple_choice",
        options: ["とても丁寧な印象", "怒っている印象", "子供っぽい印象", "悲しい印象"],
        correctAnswer: "子供っぽい印象",
        timestamp: 125,
      },
      {
        question: "「いいえ」や「いえ」を「いや」の代わりに使うべきなのは、どのような場面ですか？",
        type: "multiple_choice",
        options: ["友達との会話", "家族との会話", "アルバイトや仕事の面接", "カジュアルな場面"],
        correctAnswer: "アルバイトや仕事の面接",
        timestamp: 205,
      },
    ],
  },

  // REAL YOUTUBE VIDEO - My Life as a Pregnant Mom in Japan
  {
    videoId: "1Oj5gTNjZV8",
    language: "japanese",
    level: "N3",
    title: "My Life as a Pregnant Mom in Japan (Second Baby Edition)",
    description: "Video by Karen Shidahara",
    duration: 894,
    transcript: [
      {
        text: "私1人目女の子で次も女の子なんですよ。いや、絶対可愛いじゃないですか。",
        start: 0,
        duration: 10,
      },
      { text: "こんにちは、カレンです。皆さん元気ですか?", start: 10, duration: 7 },
      {
        text: "私は元気にしてますよ。あの、もうすぐ子供が生まれるんですけども、結構あの、今回の妊娠はすごくあの、トラブルが少なかったかな。",
        start: 17,
        duration: 22,
      },
      {
        text: "前回に比べて、あの、やっぱ2回目っていうこともあり、結構なんか対応できるトラブルが起こってもこう心をしっかりと構えていられる、対応できることが多かったなと思ってます。",
        start: 39,
        duration: 17,
      },
      {
        text: "で、前回は本当に本当に歩くのも辛いぐらい、同じ時期今と同じ収数ぐらいの時歩くのも辛かったんですけど、今はそんなことなくて",
        start: 56,
        duration: 9,
      },
      {
        text: "やっぱ1回目と2回目でもこんなに違うんだって、えっと思いながら妊婦生活を過ごしています。",
        start: 65,
        duration: 7,
      },
      {
        text: "それでですね、今日はフリートークでは日本人のあの妊婦のお話をしていきたいと思います。",
        start: 72,
        duration: 12,
      },
      {
        text: "全ての妊婦さんがそうっていうわけではないので、なんか私だと思って、私のことだと思って聞いていただければ大変嬉しく思います。それでは始めていきますね。",
        start: 84,
        duration: 10,
      },
      {
        text: "妊娠が分かった時は本当に予想外で、ま、予想外っていう言い方あってるとかなんかびっくりしました。",
        start: 94,
        duration: 11,
      },
      {
        text: "そう、まだ上の娘も小さかったですし、まだ一切なってなかったんですよね。何ヶ月かな?7ヶ月とか8ヶ月ぐらいだったと思うんですけども。",
        start: 105,
        duration: 16,
      },
      {
        text: "でも本当にびっくりしました。で、まだその娘も小さいですし、受入もしてましたし",
        start: 121,
        duration: 11,
      },
      {
        text: "で、あの妊娠するとあの受入をやめなきゃいけないんですよね。っていうのがその子宮がこう収縮、受入することによって子宮が収縮されて",
        start: 132,
        duration: 12,
      },
      {
        text: "えっと赤ちゃんが流れてしまう流算してしまう可能性っていうのが上がるので受入もやめなきゃいけない。嬉しい反面。驚きと嬉しいと複雑がもう一気にこう来ましたね。",
        start: 144,
        duration: 16,
      },
      {
        text: "赤ちゃん、ま、ずっと動いてるんですけども大きくなるにつれて私まで動いてるのが伝わってくるんですよね。",
        start: 160,
        duration: 10,
      },
      {
        text: "っていうのが分かった時にもうすごいあのお腹をこうねなあかんて言っちゃったこうお腹を撫でたりとかあと最近で言うともう結構もうバコバゴ蹴ってくるんで",
        start: 170,
        duration: 11,
      },
      {
        text: "あの蹴られたら私もこう押し返すて言うんですかね。っていう感じでコミュニケーションは取っています。",
        start: 181,
        duration: 6,
      },
      {
        text: "妊婦さんの時ってNGな食材とか結構たくさんあるんですよね。食べられないもんとかたくさんあるので、そういったものは基本的に食べないことと",
        start: 187,
        duration: 10,
      },
      {
        text: "あと、えっと、望をしない。あとはもう、えっと、1人目の時はすごくあの、歩けないぐらいお尻が痛かったので、あまり運動できなかったんですけれども",
        start: 197,
        duration: 14,
      },
      {
        text: "2人目になるとお尻全然痛くないんですよ。股関節は痛いんですけど、関節は痛いんですけども、お尻全然痛くないので全然あの歩けるので",
        start: 211,
        duration: 9,
      },
      {
        text: "あと娘のね子育てもありますしもう働いてたのも前回の妊娠の時より2倍の日数時間働いてるので",
        start: 220,
        duration: 11,
      },
      {
        text: "そういった面ではやっぱ体を動かしているっていうところはすごくね気をつけてるってかましなきゃいけなくて",
        start: 231,
        duration: 10,
      },
      {
        text: "そういう生活で体を動かしてるのもありますけどもやっぱ犬の散歩に行くとか娘と一緒にお出かけするとかそういった面では本当に強制的に体を動かしているっていう感じになります。",
        start: 241,
        duration: 14,
      },
      {
        text: "3級育級級っていうのがありまして3級生む時ですね予定日から6周前まで遡ってえっと3級が取ります取れます。",
        start: 255,
        duration: 14,
      },
      {
        text: "で、運んで8周まで3級が取れます。で、そこからは育児休暇という育級っていう期間になるんですけども",
        start: 269,
        duration: 9,
      },
      {
        text: "基本的にはそのお子さんが1歳になるまで満一になるまでえっと育児休暇が取れる会社が多いというイメージですね。",
        start: 278,
        duration: 9,
      },
      {
        text: "あとはやっぱりあの公務員と呼ばれる仕事の方とかは3歳になるまでえっと育級を取られる方もいらっしゃいます。",
        start: 287,
        duration: 12,
      },
      {
        text: "電車に乗った時にすごい速さで変わってくれたのが若い女の子。若い女の子と息のか電車。",
        start: 299,
        duration: 9,
      },
      {
        text: "若い女の子が譲ってくれて。これもすごい嬉しかったですね。あとおじさん私よりか確実に5年齢が上のでもまだ言っても50代とか50代うんくらいかなっていう",
        start: 308,
        duration: 19,
      },
      { text: "おじさんが席を譲ってくださってすごい嬉しかったですね。", start: 327, duration: 11 },
      {
        text: "なんかやっぱりな、何て言うんだろう?譲らないっていう、譲りたくない、気づかない人ってたくさんいらっしゃいますし、",
        start: 338,
        duration: 12,
      },
      {
        text: "そういうニュースとかね、SNSでそういうつぶやきとかを見た時に、あの、悲しいなって思ったりね、するんですけどね。",
        start: 350,
        duration: 9,
      },
      {
        text: "やっぱそういうのを見てるからこそ譲ってもらえた時ってやっぱ当たり前じゃないんだなって思いますし嬉しい気持ちになりましたね。",
        start: 359,
        duration: 11,
      },
      {
        text: "私それこそ今日この後あのピラティスやってみようと思ってピラティス行くんですよ。はい。初めて初めて行きます。めちゃくちゃ楽しみです。",
        start: 370,
        duration: 16,
      },
      {
        text: "ピラティスだったりとかあとヨガされる方とかもいますね。私は基本的にあの足がすごくむのでマッサージと",
        start: 386,
        duration: 8,
      },
      {
        text: "あと股関節を柔らかくするストレッチをしてるんですけどもうんあとはまひたすら歩く散歩するとかそういった感じで色々あります。",
        start: 394,
        duration: 13,
      },
      {
        text: "私は今日ピラティスに行ってきます。日本の伝統的な習慣として犬の日というのがあるんですよね。",
        start: 407,
        duration: 7,
      },
      {
        text: "あの、安算祈願の日なんですけど、安算祈願をするために神社にお参りをするんですよね。",
        start: 414,
        duration: 9,
      },
      {
        text: "それが、えっと、妊娠5ヶ月に入った最初の犬の日に行きます。",
        start: 423,
        duration: 5,
      },
      {
        text: "まだちょっとお腹の膨らみが分かるかな?多分わかんないなぐらいの大きさの時に神社に行って、えっと、安算祈願をしてもらって",
        start: 428,
        duration: 10,
      },
      {
        text: "なんかお米とか演技のいいものとかお札とかをもらっていただいて帰るんですけれども",
        start: 438,
        duration: 5,
      },
      {
        text: "なんで犬の日かって言うと犬ってあの子供を多く生むらしいんですよね。多く生む2匹以上で比較的に安ざなんですよ。",
        start: 443,
        duration: 16,
      },
      {
        text: "みたいなんですよね。だからその犬が安ざなことにあかって安ざを祈願してるっていうのを調べた時に",
        start: 459,
        duration: 9,
      },
      {
        text: "私も1人目の時調べた時にへえてなんで犬にって言うんだろうと思って調べた時にあそういうことかと思って納得したんですけれども",
        start: 468,
        duration: 12,
      },
      { text: "犬の日には皆さんお宮に参って安算を祈願します。", start: 480, duration: 6 },
      {
        text: "妊婦向けと言いますか、それぞれやっぱ自治体によっていろんなサービスが受けられるんですよね。",
        start: 486,
        duration: 5,
      },
      {
        text: "お母さん調子どうですかって電話かかってきたり、そのスクスクサポートっていう私が住んでるところではスクスクサポートって呼ばれてるんですけども",
        start: 491,
        duration: 14,
      },
      {
        text: "ま、そのスクスクサポートほにゃらという呼ばれているところに行くと、ま、そういうあのお話相談とか色々お話を聞いてくださって最後に子品をいただけるみたいな感じで",
        start: 505,
        duration: 13,
      },
      {
        text: "そういうサービスはあります。役場とか市役所とかで結構そういう子供に行くと相談に乗ってくださる方は常にいらっしゃるので",
        start: 518,
        duration: 10,
      },
      {
        text: "そういった面ではあの利用しできる環境があるっていうのは心強いですね。",
        start: 528,
        duration: 6,
      },
    ],
    questions: [
      {
        question: "カレンさんの1人目の子どもは何ヶ月の時に2人目の妊娠が分かりましたか？",
        type: "multiple_choice",
        options: ["3ヶ月から4ヶ月", "7ヶ月から8ヶ月", "10ヶ月から11ヶ月", "12ヶ月"],
        correctAnswer: "7ヶ月から8ヶ月",
        timestamp: 45,
      },
      {
        question: "犬の日に神社で安産祈願をするのは、犬がどのような特徴があるからですか？",
        type: "multiple_choice",
        options: [
          "犬は妊娠期間が短い",
          "犬は1匹以上の子どもを安全に生む",
          "犬は日本の伝統的な動物である",
          "犬は神社の守り神である",
        ],
        correctAnswer: "犬は1匹以上の子どもを安全に生む",
        timestamp: 320,
      },
      {
        question: "カレンさんが2人目の妊娠の方が1人目より楽だと感じている理由は何ですか？",
        type: "multiple_choice",
        options: [
          "仕事をしていないから",
          "経験があり心の準備ができているから",
          "家族のサポートが多いから",
          "若いから",
        ],
        correctAnswer: "経験があり心の準備ができているから",
        timestamp: 60,
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
        correctAnswer: "The ability to transmit complicated thoughts through language",
        timestamp: 5,
      },
      {
        question: "How does language physically reach the listener according to the talk?",
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
        correctAnswer: "Transmit knowledge across minds and across space and time",
        timestamp: 42,
      },
    ],
  },
  {
    videoId: "en_a1_greetings",
    language: "english",
    level: "A1",
    title: "Basic English Greetings",
    description: "Learn essential greetings and introductions for everyday English conversations.",
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
        options: ["Goodbye", "Nice to meet you", "See you later", "Good morning"],
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
    description: "Learn vocabulary and phrases to describe your daily activities in English.",
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
        options: ["Six o'clock", "Seven o'clock", "Eight o'clock", "Nine o'clock"],
        correctAnswer: "Seven o'clock",
        timestamp: 3,
      },
      {
        question: "What does the speaker usually have for breakfast?",
        type: "multiple_choice",
        options: ["Rice and eggs", "Toast and coffee", "Cereal and milk", "Fruit and yogurt"],
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
    description: "Practice common phrases and vocabulary for shopping in English.",
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
    description: "Learn popular English idioms and their meanings for more natural conversation.",
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
    description: "Learn the essential phrases for introducing yourself in French conversations.",
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
        options: ["Je suis Marie", "Je m'appelle Marie", "Je viens de Marie", "Je parle Marie"],
        correctAnswer: "Je m'appelle Marie",
        timestamp: 9,
      },
      {
        question: "Comment dit-on d'où on vient?",
        type: "multiple_choice",
        options: ["Je suis de Paris", "Je parle Paris", "Je viens de Paris", "Je m'appelle Paris"],
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
    description: "Master counting from 1 to 100 in French with correct pronunciation.",
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
    description: "Learn essential food vocabulary for ordering at restaurants and shopping.",
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
        options: ["À la pharmacie", "À la boulangerie", "Au supermarché", "Au restaurant"],
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
        options: ["Tournez à gauche", "Tournez à droite", "Allez tout droit", "C'est au coin"],
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
    description: "Master the French past tense with être and avoir auxiliaries.",
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
        question: "Quel auxiliaire utilise-t-on avec les verbes de mouvement?",
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
        errors.push(`${prefix}: transcript segment ${segIndex + 1} has empty text`);
      }
      if (typeof seg.start !== "number" || seg.start < 0) {
        errors.push(`${prefix}: transcript segment ${segIndex + 1} has invalid start time`);
      }
      if (typeof seg.duration !== "number" || seg.duration <= 0) {
        errors.push(`${prefix}: transcript segment ${segIndex + 1} has invalid duration`);
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
        errors.push(`${prefix}: question ${qIndex + 1} must be type "multiple_choice"`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`${prefix}: question ${qIndex + 1} must have at least 2 options`);
      }
      if (!q.correctAnswer || !q.options?.includes(q.correctAnswer)) {
        errors.push(`${prefix}: question ${qIndex + 1} correctAnswer must be one of the options`);
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
      errors.push(`${prefix}: ${video.language} level should be A1-C2 (got "${video.level}")`);
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
