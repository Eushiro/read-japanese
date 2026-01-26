/**
 * Hardcoded definition translations for premade vocabulary.
 *
 * Each word has translations in all UI languages: en, ja, fr, zh
 * Keyed by word string, matching the word field in premadeVocabulary.
 *
 * Note: Some words have multiple definitions (originally separated by semicolons).
 * These are represented as separate objects in the array.
 */

export type DefinitionTranslation = { en: string; ja: string; fr: string; zh: string };

export const premadeTranslations: Record<string, DefinitionTranslation[]> = {
  // ============================================
  // JAPANESE TOP 100 (100 words)
  // ============================================

  // Verbs
  食べる: [{ en: "to eat", ja: "食べ物を口に入れて飲み込むこと", fr: "manger", zh: "吃" }],
  飲む: [{ en: "to drink", ja: "液体を口から体内に入れること", fr: "boire", zh: "喝" }],
  行く: [{ en: "to go", ja: "ある場所から別の場所へ移動すること", fr: "aller", zh: "去" }],
  来る: [{ en: "to come", ja: "こちらへ近づくこと", fr: "venir", zh: "来" }],
  見る: [
    { en: "to see", ja: "目で物を認識すること", fr: "voir", zh: "看" },
    { en: "to watch", ja: "注意して見ること", fr: "regarder", zh: "观看" },
  ],
  聞く: [
    { en: "to listen", ja: "音や声を耳で受け取ること", fr: "écouter", zh: "听" },
    { en: "to hear", ja: "音が耳に入ること", fr: "entendre", zh: "听到" },
    { en: "to ask", ja: "質問すること", fr: "demander", zh: "问" },
  ],
  話す: [
    { en: "to speak", ja: "言葉を発すること", fr: "parler", zh: "说" },
    { en: "to talk", ja: "会話すること", fr: "parler", zh: "谈话" },
  ],
  読む: [{ en: "to read", ja: "文字を見て意味を理解すること", fr: "lire", zh: "读" }],
  書く: [{ en: "to write", ja: "文字を記すこと", fr: "écrire", zh: "写" }],
  買う: [{ en: "to buy", ja: "お金を払って物を手に入れること", fr: "acheter", zh: "买" }],
  寝る: [{ en: "to sleep", ja: "眠ること", fr: "dormir", zh: "睡觉" }],
  起きる: [
    { en: "to wake up", ja: "眠りから目覚めること", fr: "se réveiller", zh: "醒来" },
    { en: "to get up", ja: "体を起こすこと", fr: "se lever", zh: "起床" },
  ],
  歩く: [{ en: "to walk", ja: "足を使って移動すること", fr: "marcher", zh: "走路" }],
  走る: [{ en: "to run", ja: "速く移動すること", fr: "courir", zh: "跑" }],
  待つ: [{ en: "to wait", ja: "来るのを待つこと", fr: "attendre", zh: "等待" }],
  会う: [{ en: "to meet", ja: "人と顔を合わせること", fr: "rencontrer", zh: "见面" }],
  作る: [
    { en: "to make", ja: "新しく生み出すこと", fr: "faire", zh: "做" },
    { en: "to create", ja: "創造すること", fr: "créer", zh: "创造" },
  ],
  使う: [{ en: "to use", ja: "道具などを用いること", fr: "utiliser", zh: "使用" }],
  思う: [{ en: "to think", ja: "心の中で考えること", fr: "penser", zh: "想" }],
  知る: [{ en: "to know", ja: "情報を持っていること", fr: "savoir", zh: "知道" }],
  分かる: [{ en: "to understand", ja: "意味を理解すること", fr: "comprendre", zh: "明白" }],
  教える: [
    { en: "to teach", ja: "知識を伝えること", fr: "enseigner", zh: "教" },
    { en: "to tell", ja: "伝えること", fr: "dire", zh: "告诉" },
  ],
  習う: [{ en: "to learn", ja: "人から教わること", fr: "apprendre", zh: "学习" }],
  働く: [{ en: "to work", ja: "仕事をすること", fr: "travailler", zh: "工作" }],
  遊ぶ: [{ en: "to play", ja: "楽しむために何かをすること", fr: "jouer", zh: "玩" }],
  入る: [{ en: "to enter", ja: "中に入ること", fr: "entrer", zh: "进入" }],
  出る: [
    { en: "to exit", ja: "外に出ること", fr: "sortir", zh: "出去" },
    { en: "to leave", ja: "去ること", fr: "partir", zh: "离开" },
  ],
  開ける: [{ en: "to open", ja: "閉じているものを開くこと", fr: "ouvrir", zh: "打开" }],
  閉める: [{ en: "to close", ja: "開いているものを閉じること", fr: "fermer", zh: "关闭" }],
  立つ: [{ en: "to stand", ja: "足で体を支えて直立すること", fr: "se tenir debout", zh: "站立" }],
  座る: [{ en: "to sit", ja: "腰を下ろすこと", fr: "s'asseoir", zh: "坐" }],
  持つ: [
    { en: "to hold", ja: "手に取って支えること", fr: "tenir", zh: "拿着" },
    { en: "to have", ja: "所有していること", fr: "avoir", zh: "拥有" },
  ],
  置く: [
    { en: "to put", ja: "物を特定の場所に配置すること", fr: "poser", zh: "放" },
    { en: "to place", ja: "置くこと", fr: "placer", zh: "放置" },
  ],
  取る: [{ en: "to take", ja: "手に取ること", fr: "prendre", zh: "拿" }],
  始まる: [{ en: "to begin", ja: "開始すること", fr: "commencer", zh: "开始" }],
  終わる: [{ en: "to end", ja: "完了すること", fr: "finir", zh: "结束" }],
  住む: [
    { en: "to live", ja: "ある場所に暮らすこと", fr: "habiter", zh: "住" },
    { en: "to reside", ja: "居住すること", fr: "résider", zh: "居住" },
  ],
  洗う: [{ en: "to wash", ja: "水などで汚れを落とすこと", fr: "laver", zh: "洗" }],
  着る: [{ en: "to wear", ja: "服を身につけること", fr: "porter", zh: "穿" }],
  脱ぐ: [{ en: "to take off clothes", ja: "服を体から外すこと", fr: "enlever", zh: "脱" }],

  // Time
  時間: [{ en: "time", ja: "過ぎていく時の流れ", fr: "temps", zh: "时间" }],
  今日: [{ en: "today", ja: "この日", fr: "aujourd'hui", zh: "今天" }],
  明日: [{ en: "tomorrow", ja: "次の日", fr: "demain", zh: "明天" }],
  昨日: [{ en: "yesterday", ja: "前の日", fr: "hier", zh: "昨天" }],
  朝: [{ en: "morning", ja: "一日の始まりの時間帯", fr: "matin", zh: "早上" }],
  夜: [
    { en: "night", ja: "暗い時間帯", fr: "nuit", zh: "夜晚" },
    { en: "evening", ja: "日が暮れる頃", fr: "soir", zh: "晚上" },
  ],
  午前: [
    { en: "morning", ja: "正午より前の時間", fr: "matin", zh: "上午" },
    { en: "AM", ja: "午前中", fr: "du matin", zh: "上午" },
  ],
  午後: [
    { en: "afternoon", ja: "正午から夕方までの時間", fr: "après-midi", zh: "下午" },
    { en: "PM", ja: "午後の時間帯", fr: "de l'après-midi", zh: "下午" },
  ],
  毎日: [{ en: "every day", ja: "日々", fr: "tous les jours", zh: "每天" }],
  今週: [{ en: "this week", ja: "この週", fr: "cette semaine", zh: "本周" }],

  // Food & Drink
  水: [{ en: "water", ja: "飲める無色透明の液体", fr: "eau", zh: "水" }],
  お茶: [{ en: "tea", ja: "茶葉から作る飲み物", fr: "thé", zh: "茶" }],
  ご飯: [
    { en: "rice", ja: "炊いた米", fr: "riz", zh: "米饭" },
    { en: "meal", ja: "食事", fr: "repas", zh: "饭" },
  ],
  パン: [{ en: "bread", ja: "小麦粉で作った食べ物", fr: "pain", zh: "面包" }],
  肉: [{ en: "meat", ja: "動物の食用部分", fr: "viande", zh: "肉" }],
  魚: [{ en: "fish", ja: "水中に住む動物", fr: "poisson", zh: "鱼" }],
  野菜: [{ en: "vegetables", ja: "植物の食用部分", fr: "légumes", zh: "蔬菜" }],
  果物: [{ en: "fruit", ja: "植物の甘い実", fr: "fruit", zh: "水果" }],

  // Family & People
  友達: [{ en: "friend", ja: "親しい人", fr: "ami", zh: "朋友" }],
  家族: [{ en: "family", ja: "血縁や婚姻でつながった人々", fr: "famille", zh: "家人" }],
  父: [{ en: "father", ja: "お父さん", fr: "père", zh: "父亲" }],
  母: [{ en: "mother", ja: "お母さん", fr: "mère", zh: "母亲" }],
  兄: [{ en: "older brother", ja: "年上の男の兄弟", fr: "frère aîné", zh: "哥哥" }],
  姉: [{ en: "older sister", ja: "年上の女の姉妹", fr: "sœur aînée", zh: "姐姐" }],
  弟: [{ en: "younger brother", ja: "年下の男の兄弟", fr: "frère cadet", zh: "弟弟" }],
  妹: [{ en: "younger sister", ja: "年下の女の姉妹", fr: "sœur cadette", zh: "妹妹" }],

  // School & Work
  学校: [{ en: "school", ja: "教育を受ける場所", fr: "école", zh: "学校" }],
  先生: [{ en: "teacher", ja: "教える人", fr: "professeur", zh: "老师" }],
  学生: [{ en: "student", ja: "学ぶ人", fr: "étudiant", zh: "学生" }],
  仕事: [
    { en: "work", ja: "働くこと", fr: "travail", zh: "工作" },
    { en: "job", ja: "職業", fr: "emploi", zh: "职业" },
  ],
  会社: [{ en: "company", ja: "商売をする組織", fr: "entreprise", zh: "公司" }],

  // Transportation & Places
  電車: [{ en: "train", ja: "線路を走る乗り物", fr: "train", zh: "电车" }],
  車: [{ en: "car", ja: "自動車", fr: "voiture", zh: "汽车" }],
  駅: [{ en: "station", ja: "電車が止まる場所", fr: "gare", zh: "车站" }],
  道: [
    { en: "road", ja: "人や車が通る所", fr: "route", zh: "路" },
    { en: "way", ja: "方法", fr: "chemin", zh: "方式" },
  ],
  部屋: [{ en: "room", ja: "建物の中の区切られた空間", fr: "chambre", zh: "房间" }],
  家: [
    { en: "house", ja: "住む建物", fr: "maison", zh: "房子" },
    { en: "home", ja: "自分の住む場所", fr: "maison", zh: "家" },
  ],
  店: [
    { en: "shop", ja: "商品を売る場所", fr: "magasin", zh: "店" },
    { en: "store", ja: "店舗", fr: "boutique", zh: "商店" },
  ],
  病院: [{ en: "hospital", ja: "病気を治す場所", fr: "hôpital", zh: "医院" }],

  // Adjectives
  大きい: [
    { en: "big", ja: "サイズが大きいこと", fr: "grand", zh: "大" },
    { en: "large", ja: "面積や量が多いこと", fr: "grand", zh: "大的" },
  ],
  小さい: [
    { en: "small", ja: "サイズが小さいこと", fr: "petit", zh: "小" },
    { en: "little", ja: "量が少ないこと", fr: "petit", zh: "小的" },
  ],
  新しい: [{ en: "new", ja: "最近できたこと", fr: "nouveau", zh: "新" }],
  古い: [{ en: "old", ja: "昔からあること", fr: "vieux", zh: "旧" }],
  高い: [
    { en: "expensive", ja: "値段が高いこと", fr: "cher", zh: "贵" },
    { en: "tall", ja: "背が高いこと", fr: "grand", zh: "高" },
    { en: "high", ja: "位置が高いこと", fr: "haut", zh: "高的" },
  ],
  安い: [
    { en: "cheap", ja: "値段が低いこと", fr: "bon marché", zh: "便宜" },
    { en: "inexpensive", ja: "安価なこと", fr: "pas cher", zh: "不贵" },
  ],
  良い: [{ en: "good", ja: "質が優れていること", fr: "bon", zh: "好" }],
  悪い: [{ en: "bad", ja: "質が劣っていること", fr: "mauvais", zh: "坏" }],
  長い: [{ en: "long", ja: "長さがあること", fr: "long", zh: "长" }],
  短い: [{ en: "short", ja: "長さが足りないこと", fr: "court", zh: "短" }],
  暑い: [{ en: "hot (weather)", ja: "気温が高いこと", fr: "chaud", zh: "热" }],
  寒い: [{ en: "cold (weather)", ja: "気温が低いこと", fr: "froid", zh: "冷" }],
  難しい: [{ en: "difficult", ja: "簡単ではないこと", fr: "difficile", zh: "难" }],
  簡単: [
    { en: "easy", ja: "難しくないこと", fr: "facile", zh: "简单" },
    { en: "simple", ja: "複雑でないこと", fr: "simple", zh: "简单的" },
  ],
  元気: [
    { en: "healthy", ja: "体調が良いこと", fr: "en bonne santé", zh: "健康" },
    { en: "energetic", ja: "活力があること", fr: "énergique", zh: "精力充沛" },
  ],
  忙しい: [{ en: "busy", ja: "やることが多いこと", fr: "occupé", zh: "忙" }],
  楽しい: [
    { en: "fun", ja: "気持ちが明るくなること", fr: "amusant", zh: "有趣" },
    { en: "enjoyable", ja: "楽しめること", fr: "agréable", zh: "愉快" },
  ],
  嬉しい: [
    { en: "happy", ja: "喜びを感じること", fr: "heureux", zh: "高兴" },
    { en: "glad", ja: "満足していること", fr: "content", zh: "开心" },
  ],

  // Objects
  本: [{ en: "book", ja: "文字が書かれた紙の束", fr: "livre", zh: "书" }],
  映画: [
    { en: "movie", ja: "動く映像作品", fr: "film", zh: "电影" },
    { en: "film", ja: "映画", fr: "film", zh: "影片" },
  ],
  音楽: [{ en: "music", ja: "メロディーやリズムのある音", fr: "musique", zh: "音乐" }],

  // ============================================
  // FRENCH TOP 100 (100 words)
  // ============================================

  // Verbs
  manger: [{ en: "to eat", ja: "食べる", fr: "consommer de la nourriture", zh: "吃" }],
  boire: [{ en: "to drink", ja: "飲む", fr: "consommer un liquide", zh: "喝" }],
  aller: [{ en: "to go", ja: "行く", fr: "se déplacer vers un lieu", zh: "去" }],
  venir: [{ en: "to come", ja: "来る", fr: "se déplacer vers ici", zh: "来" }],
  voir: [{ en: "to see", ja: "見る", fr: "percevoir avec les yeux", zh: "看见" }],
  regarder: [
    { en: "to watch", ja: "見る、観る", fr: "observer attentivement", zh: "观看" },
    { en: "to look at", ja: "眺める", fr: "diriger son regard vers", zh: "看" },
  ],
  écouter: [{ en: "to listen", ja: "聞く", fr: "prêter attention aux sons", zh: "听" }],
  parler: [
    { en: "to speak", ja: "話す", fr: "s'exprimer oralement", zh: "说" },
    { en: "to talk", ja: "会話する", fr: "avoir une conversation", zh: "谈话" },
  ],
  lire: [{ en: "to read", ja: "読む", fr: "interpréter des textes écrits", zh: "读" }],
  écrire: [{ en: "to write", ja: "書く", fr: "former des lettres ou des mots", zh: "写" }],
  acheter: [{ en: "to buy", ja: "買う", fr: "acquérir contre de l'argent", zh: "买" }],
  dormir: [{ en: "to sleep", ja: "眠る", fr: "se reposer en dormant", zh: "睡觉" }],
  travailler: [
    { en: "to work", ja: "働く", fr: "exercer une activité professionnelle", zh: "工作" },
  ],
  jouer: [{ en: "to play", ja: "遊ぶ", fr: "s'amuser, pratiquer un jeu", zh: "玩" }],
  attendre: [{ en: "to wait", ja: "待つ", fr: "rester en place jusqu'à", zh: "等待" }],
  rencontrer: [{ en: "to meet", ja: "会う", fr: "faire la connaissance de", zh: "遇见" }],
  faire: [
    { en: "to do", ja: "する", fr: "accomplir une action", zh: "做" },
    { en: "to make", ja: "作る", fr: "créer, fabriquer", zh: "制作" },
  ],
  utiliser: [{ en: "to use", ja: "使う", fr: "se servir de", zh: "使用" }],
  penser: [{ en: "to think", ja: "思う、考える", fr: "réfléchir, avoir une idée", zh: "想" }],
  savoir: [
    { en: "to know (facts)", ja: "知る（事実を）", fr: "avoir connaissance de", zh: "知道" },
  ],
  connaître: [
    {
      en: "to know (people/places)",
      ja: "知る（人・場所を）",
      fr: "être familier avec",
      zh: "认识",
    },
  ],
  apprendre: [{ en: "to learn", ja: "学ぶ", fr: "acquérir des connaissances", zh: "学习" }],
  enseigner: [{ en: "to teach", ja: "教える", fr: "transmettre des connaissances", zh: "教" }],
  aider: [{ en: "to help", ja: "助ける", fr: "apporter son aide", zh: "帮助" }],
  donner: [{ en: "to give", ja: "あげる", fr: "remettre quelque chose", zh: "给" }],
  prendre: [{ en: "to take", ja: "取る", fr: "saisir, emporter", zh: "拿" }],
  mettre: [
    { en: "to put", ja: "置く", fr: "placer quelque chose", zh: "放" },
    { en: "to wear", ja: "着る", fr: "porter un vêtement", zh: "穿" },
  ],
  ouvrir: [{ en: "to open", ja: "開ける", fr: "rendre accessible", zh: "打开" }],
  fermer: [{ en: "to close", ja: "閉める", fr: "rendre inaccessible", zh: "关闭" }],
  commencer: [
    { en: "to begin", ja: "始める", fr: "entreprendre, débuter", zh: "开始" },
    { en: "to start", ja: "始まる", fr: "initier", zh: "开始" },
  ],
  finir: [{ en: "to finish", ja: "終わる", fr: "achever, compléter", zh: "结束" }],
  habiter: [
    { en: "to live", ja: "住む", fr: "résider dans un lieu", zh: "住" },
    { en: "to reside", ja: "居住する", fr: "avoir son domicile", zh: "居住" },
  ],
  aimer: [
    { en: "to love", ja: "愛する", fr: "éprouver de l'amour", zh: "爱" },
    { en: "to like", ja: "好きである", fr: "apprécier", zh: "喜欢" },
  ],
  détester: [{ en: "to hate", ja: "嫌う", fr: "avoir de l'aversion pour", zh: "讨厌" }],
  vouloir: [{ en: "to want", ja: "欲しい、したい", fr: "désirer, souhaiter", zh: "想要" }],
  pouvoir: [
    { en: "to be able to", ja: "できる", fr: "avoir la capacité de", zh: "能够" },
    { en: "can", ja: "可能である", fr: "avoir la possibilité", zh: "可以" },
  ],
  devoir: [
    { en: "to have to", ja: "しなければならない", fr: "être obligé de", zh: "必须" },
    { en: "must", ja: "すべきである", fr: "avoir l'obligation de", zh: "应该" },
  ],

  // Time
  temps: [
    { en: "time", ja: "時間", fr: "durée, moment", zh: "时间" },
    { en: "weather", ja: "天気", fr: "conditions atmosphériques", zh: "天气" },
  ],
  jour: [{ en: "day", ja: "日", fr: "période de 24 heures", zh: "天" }],
  semaine: [{ en: "week", ja: "週", fr: "période de sept jours", zh: "周" }],
  mois: [{ en: "month", ja: "月", fr: "période d'environ 30 jours", zh: "月" }],
  année: [{ en: "year", ja: "年", fr: "période de 365 jours", zh: "年" }],
  matin: [{ en: "morning", ja: "朝", fr: "début de la journée", zh: "早上" }],
  soir: [{ en: "evening", ja: "夕方、晩", fr: "fin de la journée", zh: "晚上" }],
  nuit: [{ en: "night", ja: "夜", fr: "période d'obscurité", zh: "夜晚" }],
  "aujourd'hui": [{ en: "today", ja: "今日", fr: "ce jour-ci", zh: "今天" }],
  demain: [{ en: "tomorrow", ja: "明日", fr: "le jour suivant", zh: "明天" }],
  hier: [{ en: "yesterday", ja: "昨日", fr: "le jour précédent", zh: "昨天" }],
  maintenant: [{ en: "now", ja: "今", fr: "en ce moment", zh: "现在" }],

  // Food & Drink
  eau: [{ en: "water", ja: "水", fr: "liquide transparent et inodore", zh: "水" }],
  café: [{ en: "coffee", ja: "コーヒー", fr: "boisson à base de grains torréfiés", zh: "咖啡" }],
  pain: [{ en: "bread", ja: "パン", fr: "aliment fait de farine cuite", zh: "面包" }],
  viande: [{ en: "meat", ja: "肉", fr: "chair animale comestible", zh: "肉" }],
  poisson: [{ en: "fish", ja: "魚", fr: "animal aquatique comestible", zh: "鱼" }],
  légumes: [{ en: "vegetables", ja: "野菜", fr: "plantes comestibles", zh: "蔬菜" }],
  fruit: [{ en: "fruit", ja: "果物", fr: "produit sucré d'une plante", zh: "水果" }],
  repas: [{ en: "meal", ja: "食事", fr: "nourriture prise à heures fixes", zh: "餐" }],

  // Family & People
  ami: [
    { en: "friend", ja: "友達", fr: "personne avec qui on a des liens d'affection", zh: "朋友" },
  ],
  famille: [{ en: "family", ja: "家族", fr: "ensemble des personnes apparentées", zh: "家人" }],
  père: [{ en: "father", ja: "父", fr: "parent masculin", zh: "父亲" }],
  mère: [{ en: "mother", ja: "母", fr: "parent féminin", zh: "母亲" }],
  frère: [{ en: "brother", ja: "兄弟", fr: "garçon de mêmes parents", zh: "兄弟" }],
  soeur: [{ en: "sister", ja: "姉妹", fr: "fille de mêmes parents", zh: "姐妹" }],
  enfant: [{ en: "child", ja: "子供", fr: "jeune personne", zh: "孩子" }],
  homme: [{ en: "man", ja: "男性", fr: "être humain de sexe masculin", zh: "男人" }],
  femme: [{ en: "woman", ja: "女性", fr: "être humain de sexe féminin", zh: "女人" }],

  // School & Work
  école: [{ en: "school", ja: "学校", fr: "établissement d'enseignement", zh: "学校" }],
  professeur: [{ en: "teacher", ja: "先生", fr: "personne qui enseigne", zh: "老师" }],
  étudiant: [{ en: "student", ja: "学生", fr: "personne qui étudie", zh: "学生" }],
  travail: [
    { en: "work", ja: "仕事", fr: "activité professionnelle", zh: "工作" },
    { en: "job", ja: "職業", fr: "emploi rémunéré", zh: "职业" },
  ],
  bureau: [{ en: "office", ja: "事務所", fr: "lieu de travail", zh: "办公室" }],

  // Places
  maison: [
    { en: "house", ja: "家", fr: "bâtiment d'habitation", zh: "房子" },
    { en: "home", ja: "自宅", fr: "lieu où l'on vit", zh: "家" },
  ],
  appartement: [{ en: "apartment", ja: "アパート", fr: "logement dans un immeuble", zh: "公寓" }],
  rue: [{ en: "street", ja: "通り", fr: "voie urbaine", zh: "街道" }],
  ville: [{ en: "city", ja: "都市", fr: "grande agglomération", zh: "城市" }],
  pays: [{ en: "country", ja: "国", fr: "territoire d'une nation", zh: "国家" }],

  // Transportation
  voiture: [{ en: "car", ja: "車", fr: "véhicule automobile", zh: "汽车" }],
  train: [{ en: "train", ja: "電車", fr: "véhicule ferroviaire", zh: "火车" }],
  avion: [{ en: "airplane", ja: "飛行機", fr: "véhicule aérien", zh: "飞机" }],
  magasin: [
    { en: "store", ja: "店", fr: "établissement commercial", zh: "商店" },
    { en: "shop", ja: "店舗", fr: "boutique", zh: "店铺" },
  ],
  restaurant: [
    { en: "restaurant", ja: "レストラン", fr: "établissement de restauration", zh: "餐厅" },
  ],
  hôpital: [{ en: "hospital", ja: "病院", fr: "établissement de soins", zh: "医院" }],

  // Adjectives
  grand: [
    { en: "big", ja: "大きい", fr: "de grande taille", zh: "大" },
    { en: "tall", ja: "背が高い", fr: "de grande hauteur", zh: "高" },
  ],
  petit: [
    { en: "small", ja: "小さい", fr: "de petite taille", zh: "小" },
    { en: "little", ja: "少ない", fr: "de faible quantité", zh: "少" },
  ],
  nouveau: [{ en: "new", ja: "新しい", fr: "récent, qui vient d'apparaître", zh: "新" }],
  vieux: [{ en: "old", ja: "古い、年老いた", fr: "qui a beaucoup d'années", zh: "老" }],
  cher: [{ en: "expensive", ja: "高価な", fr: "qui coûte beaucoup", zh: "贵" }],
  bon: [{ en: "good", ja: "良い", fr: "de qualité satisfaisante", zh: "好" }],
  mauvais: [{ en: "bad", ja: "悪い", fr: "de mauvaise qualité", zh: "坏" }],
  long: [{ en: "long", ja: "長い", fr: "de grande longueur", zh: "长" }],
  court: [{ en: "short", ja: "短い", fr: "de faible longueur", zh: "短" }],
  chaud: [{ en: "hot", ja: "暑い、熱い", fr: "de température élevée", zh: "热" }],
  froid: [{ en: "cold", ja: "寒い、冷たい", fr: "de basse température", zh: "冷" }],
  facile: [{ en: "easy", ja: "簡単な", fr: "qui ne demande pas d'effort", zh: "容易" }],
  difficile: [{ en: "difficult", ja: "難しい", fr: "qui demande de l'effort", zh: "困难" }],
  heureux: [{ en: "happy", ja: "幸せな", fr: "qui ressent de la joie", zh: "幸福" }],
  triste: [{ en: "sad", ja: "悲しい", fr: "qui ressent de la peine", zh: "悲伤" }],
  fatigué: [{ en: "tired", ja: "疲れた", fr: "qui a besoin de repos", zh: "累" }],
  occupé: [{ en: "busy", ja: "忙しい", fr: "qui a beaucoup à faire", zh: "忙" }],

  // Objects
  livre: [{ en: "book", ja: "本", fr: "ouvrage imprimé", zh: "书" }],

  // ============================================
  // ENGLISH TOP 100 (100 words)
  // ============================================

  // Verbs
  eat: [{ en: "to consume food", ja: "食べる", fr: "manger", zh: "吃" }],
  drink: [{ en: "to consume liquid", ja: "飲む", fr: "boire", zh: "喝" }],
  go: [
    { en: "to move", ja: "移動する", fr: "se déplacer", zh: "移动" },
    { en: "to travel", ja: "旅行する", fr: "voyager", zh: "旅行" },
  ],
  come: [
    { en: "to arrive", ja: "到着する", fr: "arriver", zh: "到达" },
    { en: "to approach", ja: "近づく", fr: "s'approcher", zh: "靠近" },
  ],
  see: [{ en: "to perceive with eyes", ja: "見る", fr: "percevoir avec les yeux", zh: "看见" }],
  watch: [
    { en: "to observe", ja: "観察する", fr: "observer", zh: "观看" },
    { en: "to look at", ja: "見る", fr: "regarder", zh: "看" },
  ],
  listen: [{ en: "to hear attentively", ja: "聞く", fr: "écouter attentivement", zh: "听" }],
  speak: [
    { en: "to talk", ja: "話す", fr: "parler", zh: "说" },
    { en: "to communicate", ja: "伝える", fr: "communiquer", zh: "交流" },
  ],
  read: [{ en: "to interpret written words", ja: "読む", fr: "lire", zh: "读" }],
  write: [{ en: "to form letters or words", ja: "書く", fr: "écrire", zh: "写" }],
  buy: [{ en: "to purchase", ja: "買う", fr: "acheter", zh: "买" }],
  sleep: [
    { en: "to rest", ja: "休む", fr: "se reposer", zh: "休息" },
    { en: "to slumber", ja: "眠る", fr: "dormir", zh: "睡觉" },
  ],
  work: [
    { en: "to labor", ja: "働く", fr: "travailler", zh: "工作" },
    { en: "to be employed", ja: "勤める", fr: "être employé", zh: "就业" },
  ],
  play: [{ en: "to engage in activity for fun", ja: "遊ぶ", fr: "jouer", zh: "玩" }],
  wait: [{ en: "to stay in place", ja: "待つ", fr: "attendre", zh: "等待" }],
  meet: [
    { en: "to encounter", ja: "会う", fr: "rencontrer", zh: "遇见" },
    { en: "to come together", ja: "集まる", fr: "se réunir", zh: "聚会" },
  ],
  make: [
    { en: "to create", ja: "作る", fr: "créer", zh: "创造" },
    { en: "to produce", ja: "生産する", fr: "produire", zh: "生产" },
  ],
  use: [
    { en: "to employ", ja: "使う", fr: "employer", zh: "使用" },
    { en: "to utilize", ja: "活用する", fr: "utiliser", zh: "利用" },
  ],
  think: [
    { en: "to consider", ja: "考える", fr: "considérer", zh: "考虑" },
    { en: "to reflect", ja: "熟考する", fr: "réfléchir", zh: "反思" },
  ],
  know: [
    { en: "to be aware of", ja: "知っている", fr: "être conscient de", zh: "知道" },
    { en: "to understand", ja: "理解する", fr: "comprendre", zh: "理解" },
  ],
  learn: [{ en: "to acquire knowledge", ja: "学ぶ", fr: "acquérir des connaissances", zh: "学习" }],
  teach: [
    { en: "to instruct", ja: "教える", fr: "instruire", zh: "指导" },
    { en: "to educate", ja: "教育する", fr: "éduquer", zh: "教育" },
  ],
  help: [
    { en: "to assist", ja: "助ける", fr: "assister", zh: "帮助" },
    { en: "to aid", ja: "援助する", fr: "aider", zh: "援助" },
  ],
  give: [
    { en: "to present", ja: "渡す", fr: "présenter", zh: "呈现" },
    { en: "to provide", ja: "提供する", fr: "fournir", zh: "提供" },
  ],
  take: [
    { en: "to grab", ja: "つかむ", fr: "saisir", zh: "抓取" },
    { en: "to accept", ja: "受け取る", fr: "accepter", zh: "接受" },
  ],
  put: [
    { en: "to place", ja: "置く", fr: "placer", zh: "放置" },
    { en: "to set", ja: "設置する", fr: "mettre", zh: "设置" },
  ],
  open: [{ en: "to make accessible", ja: "開ける", fr: "ouvrir", zh: "打开" }],
  close: [
    { en: "to shut", ja: "閉める", fr: "fermer", zh: "关闭" },
    { en: "to end", ja: "終える", fr: "terminer", zh: "结束" },
  ],
  start: [
    { en: "to begin", ja: "始める", fr: "commencer", zh: "开始" },
    { en: "to commence", ja: "着手する", fr: "débuter", zh: "着手" },
  ],
  finish: [
    { en: "to complete", ja: "完成する", fr: "compléter", zh: "完成" },
    { en: "to end", ja: "終える", fr: "terminer", zh: "结束" },
  ],
  live: [
    { en: "to reside", ja: "住む", fr: "résider", zh: "居住" },
    { en: "to exist", ja: "存在する", fr: "exister", zh: "存在" },
  ],
  love: [{ en: "to feel deep affection", ja: "愛する", fr: "aimer profondément", zh: "爱" }],
  like: [
    { en: "to enjoy", ja: "楽しむ", fr: "apprécier", zh: "喜欢" },
    { en: "to prefer", ja: "好む", fr: "préférer", zh: "偏好" },
  ],
  want: [
    { en: "to desire", ja: "欲しい", fr: "désirer", zh: "想要" },
    { en: "to wish for", ja: "望む", fr: "souhaiter", zh: "希望" },
  ],
  need: [
    { en: "to require", ja: "必要とする", fr: "avoir besoin de", zh: "需要" },
    { en: "to must have", ja: "なければならない", fr: "devoir avoir", zh: "必须有" },
  ],

  // Time
  time: [
    { en: "duration", ja: "時間", fr: "durée", zh: "时间" },
    { en: "occasion", ja: "機会", fr: "occasion", zh: "时机" },
  ],
  day: [{ en: "24-hour period", ja: "日", fr: "période de 24 heures", zh: "天" }],
  week: [{ en: "seven days", ja: "週", fr: "sept jours", zh: "周" }],
  month: [{ en: "30-day period approximately", ja: "月", fr: "environ 30 jours", zh: "月" }],
  year: [
    { en: "365 days", ja: "年", fr: "365 jours", zh: "年" },
    { en: "12 months", ja: "12ヶ月", fr: "12 mois", zh: "12个月" },
  ],
  morning: [{ en: "early part of day", ja: "朝", fr: "début de la journée", zh: "早上" }],
  evening: [{ en: "late part of day", ja: "夕方", fr: "fin de la journée", zh: "晚上" }],
  night: [
    { en: "dark hours", ja: "夜", fr: "heures sombres", zh: "夜晚" },
    { en: "nighttime", ja: "夜間", fr: "période nocturne", zh: "夜间" },
  ],
  today: [{ en: "this current day", ja: "今日", fr: "ce jour-ci", zh: "今天" }],
  tomorrow: [{ en: "the next day", ja: "明日", fr: "le jour suivant", zh: "明天" }],
  yesterday: [{ en: "the previous day", ja: "昨日", fr: "le jour précédent", zh: "昨天" }],
  now: [{ en: "at this moment", ja: "今", fr: "en ce moment", zh: "现在" }],

  // Food & Drink
  water: [{ en: "liquid for drinking", ja: "水", fr: "liquide potable", zh: "水" }],
  food: [{ en: "things to eat", ja: "食べ物", fr: "nourriture", zh: "食物" }],
  bread: [{ en: "baked wheat product", ja: "パン", fr: "produit à base de blé cuit", zh: "面包" }],
  meat: [{ en: "animal flesh for eating", ja: "肉", fr: "chair animale", zh: "肉" }],
  fish: [
    { en: "aquatic animal", ja: "魚", fr: "animal aquatique", zh: "鱼" },
    { en: "seafood", ja: "海産物", fr: "fruits de mer", zh: "海鲜" },
  ],
  // Note: "fruit" already defined in French section

  // Family & People
  friend: [{ en: "close companion", ja: "友達", fr: "compagnon proche", zh: "朋友" }],
  family: [
    { en: "relatives", ja: "親戚", fr: "parents", zh: "亲戚" },
    { en: "household", ja: "家族", fr: "ménage", zh: "家庭" },
  ],
  father: [{ en: "male parent", ja: "父", fr: "parent masculin", zh: "父亲" }],
  mother: [{ en: "female parent", ja: "母", fr: "parent féminin", zh: "母亲" }],
  brother: [{ en: "male sibling", ja: "兄弟", fr: "frère", zh: "兄弟" }],
  sister: [{ en: "female sibling", ja: "姉妹", fr: "sœur", zh: "姐妹" }],
  child: [{ en: "young person", ja: "子供", fr: "jeune personne", zh: "孩子" }],
  man: [{ en: "adult male", ja: "男性", fr: "homme adulte", zh: "男人" }],
  woman: [{ en: "adult female", ja: "女性", fr: "femme adulte", zh: "女人" }],

  // School & Work
  school: [{ en: "place of learning", ja: "学校", fr: "lieu d'apprentissage", zh: "学校" }],
  teacher: [
    { en: "instructor", ja: "教師", fr: "instructeur", zh: "教师" },
    { en: "educator", ja: "教育者", fr: "éducateur", zh: "教育者" },
  ],
  student: [
    { en: "learner", ja: "学習者", fr: "apprenant", zh: "学习者" },
    { en: "pupil", ja: "生徒", fr: "élève", zh: "学生" },
  ],
  job: [
    { en: "employment", ja: "仕事", fr: "emploi", zh: "工作" },
    { en: "work position", ja: "職位", fr: "poste de travail", zh: "职位" },
  ],
  office: [
    { en: "workplace", ja: "職場", fr: "lieu de travail", zh: "工作场所" },
    { en: "business room", ja: "事務所", fr: "bureau", zh: "办公室" },
  ],

  // Places
  house: [
    { en: "dwelling", ja: "住居", fr: "habitation", zh: "住宅" },
    { en: "residence", ja: "住所", fr: "résidence", zh: "住所" },
  ],
  room: [{ en: "space within building", ja: "部屋", fr: "espace dans un bâtiment", zh: "房间" }],
  street: [{ en: "road in town", ja: "通り", fr: "route en ville", zh: "街道" }],
  city: [{ en: "large urban area", ja: "都市", fr: "grande zone urbaine", zh: "城市" }],
  country: [
    { en: "nation", ja: "国", fr: "nation", zh: "国家" },
    { en: "rural area", ja: "田舎", fr: "zone rurale", zh: "乡村" },
  ],

  // Transportation
  car: [
    { en: "automobile", ja: "自動車", fr: "automobile", zh: "汽车" },
    { en: "vehicle", ja: "車両", fr: "véhicule", zh: "车辆" },
  ],
  // Note: "train" is already defined in French section
  bus: [
    { en: "large passenger vehicle", ja: "バス", fr: "grand véhicule de passagers", zh: "公交车" },
  ],
  store: [
    { en: "shop", ja: "店", fr: "magasin", zh: "商店" },
    { en: "retail place", ja: "小売店", fr: "lieu de vente", zh: "零售店" },
  ],
  // Note: "restaurant" is already defined in French section
  hospital: [{ en: "medical facility", ja: "病院", fr: "établissement médical", zh: "医院" }],

  // Adjectives
  big: [{ en: "large in size", ja: "大きい", fr: "grand", zh: "大" }],
  small: [{ en: "little in size", ja: "小さい", fr: "petit", zh: "小" }],
  new: [
    { en: "recently made", ja: "新しい", fr: "récemment fait", zh: "新" },
    { en: "fresh", ja: "新鮮な", fr: "frais", zh: "新鲜" },
  ],
  old: [
    { en: "not new", ja: "古い", fr: "pas nouveau", zh: "旧" },
    { en: "aged", ja: "年老いた", fr: "âgé", zh: "老" },
  ],
  expensive: [
    { en: "costly", ja: "高価な", fr: "coûteux", zh: "昂贵" },
    { en: "high-priced", ja: "値段が高い", fr: "cher", zh: "高价" },
  ],
  good: [
    { en: "positive", ja: "良い", fr: "positif", zh: "好" },
    { en: "satisfactory", ja: "満足できる", fr: "satisfaisant", zh: "令人满意" },
  ],
  bad: [
    { en: "negative", ja: "悪い", fr: "négatif", zh: "坏" },
    { en: "poor quality", ja: "質が悪い", fr: "de mauvaise qualité", zh: "质量差" },
  ],
  // Note: "long" is already defined in French section
  short: [
    { en: "not long", ja: "短い", fr: "pas long", zh: "短" },
    { en: "brief", ja: "簡潔な", fr: "bref", zh: "简短" },
  ],
  hot: [{ en: "high temperature", ja: "熱い、暑い", fr: "température élevée", zh: "热" }],
  cold: [{ en: "low temperature", ja: "冷たい、寒い", fr: "basse température", zh: "冷" }],
  easy: [
    { en: "not difficult", ja: "簡単な", fr: "pas difficile", zh: "容易" },
    { en: "simple", ja: "単純な", fr: "simple", zh: "简单" },
  ],
  difficult: [
    { en: "hard", ja: "難しい", fr: "difficile", zh: "困难" },
    { en: "challenging", ja: "挑戦的な", fr: "exigeant", zh: "有挑战性" },
  ],
  happy: [{ en: "feeling joy", ja: "幸せな", fr: "ressentir de la joie", zh: "快乐" }],
  sad: [{ en: "feeling sorrow", ja: "悲しい", fr: "ressentir de la tristesse", zh: "悲伤" }],
  tired: [{ en: "needing rest", ja: "疲れた", fr: "avoir besoin de repos", zh: "累" }],
  busy: [
    { en: "occupied", ja: "忙しい", fr: "occupé", zh: "忙" },
    { en: "active", ja: "活動的な", fr: "actif", zh: "活跃" },
  ],

  // Objects
  book: [{ en: "written publication", ja: "本", fr: "publication écrite", zh: "书" }],
  movie: [
    { en: "film", ja: "映画", fr: "film", zh: "电影" },
    { en: "motion picture", ja: "動画", fr: "image animée", zh: "影片" },
  ],
  music: [
    {
      en: "sounds arranged melodically",
      ja: "音楽",
      fr: "sons arrangés mélodiquement",
      zh: "音乐",
    },
  ],
  money: [
    { en: "currency", ja: "通貨", fr: "monnaie", zh: "货币" },
    { en: "funds", ja: "資金", fr: "fonds", zh: "资金" },
  ],
  problem: [
    { en: "difficulty", ja: "困難", fr: "difficulté", zh: "困难" },
    { en: "issue", ja: "問題", fr: "problème", zh: "问题" },
  ],
};
