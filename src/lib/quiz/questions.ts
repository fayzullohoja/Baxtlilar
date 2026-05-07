export type QuizDimension =
  | "intention"
  | "tempo"
  | "roles"
  | "values"
  | "conflict"
  | "communication"
  | "scenario"
  | "family_role"
  | "future"
  | "red_flags"
  | "give"
  | "format";

export interface QuizOption {
  id: string;
  label_ru: string;
  label_uz: string;
}

export interface QuizQuestion {
  id: string;
  dimension: QuizDimension;
  multi?: { min: number; max: number };
  prompt_ru: string;
  prompt_uz: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1_intention",
    dimension: "intention",
    prompt_ru: "Зачем вы пришли в Bakhtlilar?",
    prompt_uz: "Bakhtlilarga nima uchun keldingiz?",
    options: [
      { id: "marriage", label_ru: "Хочу найти человека для брака", label_uz: "Nikoh uchun odam topmoqchiman" },
      { id: "serious", label_ru: "Хочу серьёзно познакомиться и понять совместимость", label_uz: "Jiddiy tanishmoqchi va moslikni tushunmoqchiman" },
      { id: "communication", label_ru: "Хочу начать с общения, но с серьёзным намерением", label_uz: "Muloqotdan boshlamoqchiman, lekin jiddiy niyat bilan" },
      { id: "exploring", label_ru: "Пока изучаю платформу", label_uz: "Hozircha platformani o‘rganyapman" },
    ],
  },
  {
    id: "q2_tempo",
    dimension: "tempo",
    prompt_ru: "Как быстро вы готовы перейти к реальной встрече?",
    prompt_uz: "Real uchrashuvga qancha tez tayyorsiz?",
    options: [
      { id: "week", label_ru: "В течение недели", label_uz: "Bir hafta ichida" },
      { id: "few_weeks", label_ru: "Через 2–3 недели", label_uz: "2–3 hafta ichida" },
      { id: "month", label_ru: "Через месяц", label_uz: "Bir oydan so‘ng" },
      { id: "long", label_ru: "Только после долгого общения", label_uz: "Faqat uzoq muloqotdan keyin" },
    ],
  },
  {
    id: "q3_roles",
    dimension: "roles",
    prompt_ru: "Как вы видите распределение ответственности в семье?",
    prompt_uz: "Oilada javobgarlik qanday taqsimlanishi kerak?",
    options: [
      { id: "equal", label_ru: "Оба партнёра вместе принимают решения", label_uz: "Ikki sherik birga qaror qabul qiladi" },
      { id: "man_lead", label_ru: "Мужчина — основной ответственный за семью", label_uz: "Erkak — oilaning asosiy javobgari" },
      { id: "woman_home", label_ru: "Женщина больше отвечает за дом и атмосферу", label_uz: "Ayol uy va muhitga ko‘proq mas’ul" },
      { id: "agreement", label_ru: "Главное — договорённость, а не фиксированные роли", label_uz: "Asosiysi — kelishuv, qat’iy rollar emas" },
    ],
  },
  {
    id: "q4_values",
    dimension: "values",
    multi: { min: 1, max: 3 },
    prompt_ru: "Что для вас важнее всего в будущем браке? (до 3)",
    prompt_uz: "Kelajak nikohda siz uchun nima muhimroq? (3 tagacha)",
    options: [
      { id: "respect", label_ru: "Уважение", label_uz: "Hurmat" },
      { id: "stability", label_ru: "Стабильность", label_uz: "Barqarorlik" },
      { id: "love", label_ru: "Любовь и эмоции", label_uz: "Sevgi va his-tuyg‘ular" },
      { id: "shared_values", label_ru: "Общие ценности", label_uz: "Umumiy qadriyatlar" },
      { id: "family", label_ru: "Дети и семья", label_uz: "Farzandlar va oila" },
      { id: "growth", label_ru: "Развитие вместе", label_uz: "Birga rivojlanish" },
    ],
  },
  {
    id: "q5_conflict",
    dimension: "conflict",
    prompt_ru: "Когда возникает конфликт, вы обычно…",
    prompt_uz: "Nizo yuzaga kelganda, siz odatda…",
    options: [
      { id: "discuss", label_ru: "Сразу обсуждаю спокойно", label_uz: "Darhol xotirjam muhokama qilaman" },
      { id: "cool_down", label_ru: "Мне нужно время остыть", label_uz: "Sovush vaqti kerak" },
      { id: "avoid", label_ru: "Стараюсь избегать конфликта", label_uz: "Nizodan qochishga harakat qilaman" },
      { id: "wait_first", label_ru: "Хочу, чтобы партнёр первым сделал шаг", label_uz: "Sherikning birinchi qadam tashlashini istayman" },
    ],
  },
  {
    id: "q6_communication",
    dimension: "communication",
    prompt_ru: "Какой стиль общения вам ближе?",
    prompt_uz: "Qanday muloqot uslubi sizga yaqinroq?",
    options: [
      { id: "lots", label_ru: "Много общения каждый день", label_uz: "Har kuni ko‘p muloqot" },
      { id: "regular", label_ru: "Спокойное регулярное общение", label_uz: "Xotirjam doimiy muloqot" },
      { id: "meaningful", label_ru: "Меньше сообщений, больше смысла", label_uz: "Kam xabar, ko‘p ma’no" },
      { id: "calls", label_ru: "Лучше созвониться, чем долго писать", label_uz: "Yozishdan ko‘ra qo‘ng‘iroq qilish yaxshi" },
    ],
  },
  {
    id: "q7_scenario",
    dimension: "scenario",
    prompt_ru: "Какой сценарий знакомства вам комфортнее?",
    prompt_uz: "Qanday tanishuv stsenariysi sizga qulayroq?",
    options: [
      { id: "chat_then_meet", label_ru: "Сначала переписка, потом встреча", label_uz: "Avval yozishuv, keyin uchrashuv" },
      { id: "meet_quick", label_ru: "Быстро встретиться в общественном месте", label_uz: "Tezda jamoat joyda uchrashish" },
      { id: "call_first", label_ru: "Сначала созвон / видео", label_uz: "Avval qo‘ng‘iroq yoki video" },
      { id: "long_chat", label_ru: "Сначала долго узнать через переписку", label_uz: "Avval yozishuvda uzoq tanishish" },
    ],
  },
  {
    id: "q8_family_role",
    dimension: "family_role",
    prompt_ru: "Когда уместно подключать семью к знакомству?",
    prompt_uz: "Tanishuvga oilani qachon jalb qilish o‘rinli?",
    options: [
      { id: "after_serious", label_ru: "Когда оба поймут, что намерения серьёзные", label_uz: "Ikkalasi jiddiy niyatni tushungan paytda" },
      { id: "after_few_meetings", label_ru: "После нескольких встреч", label_uz: "Bir necha uchrashuvdan keyin" },
      { id: "near_marriage", label_ru: "Ближе к решению о браке", label_uz: "Nikoh haqidagi qarorga yaqin" },
      { id: "from_start", label_ru: "С самого начала важно мнение семьи", label_uz: "Boshidanoq oilaning fikri muhim" },
    ],
  },
  {
    id: "q9_future",
    dimension: "future",
    prompt_ru: "Где вы видите себя через 3–5 лет?",
    prompt_uz: "3–5 yildan keyin o‘zingizni qayerda ko‘rasiz?",
    options: [
      { id: "family_kids", label_ru: "Семья и дети", label_uz: "Oila va farzandlar" },
      { id: "career", label_ru: "Карьера и стабильность", label_uz: "Karyera va barqarorlik" },
      { id: "business", label_ru: "Свой бизнес / развитие", label_uz: "O‘z biznesim / rivojlanish" },
      { id: "calm_family", label_ru: "Спокойная семейная жизнь", label_uz: "Xotirjam oila hayoti" },
      { id: "relocation", label_ru: "Переезд / новые возможности", label_uz: "Ko‘chish / yangi imkoniyatlar" },
    ],
  },
  {
    id: "q10_red_flags",
    dimension: "red_flags",
    multi: { min: 1, max: 3 },
    prompt_ru: "Что для вас является красным флагом? (до 3)",
    prompt_uz: "Siz uchun qizil bayroq nima? (3 tagacha)",
    options: [
      { id: "rude", label_ru: "Грубость", label_uz: "Qo‘pollik" },
      { id: "lies", label_ru: "Ложь", label_uz: "Yolg‘on" },
      { id: "not_serious", label_ru: "Несерьёзность", label_uz: "Jiddiy emaslik" },
      { id: "irresponsible", label_ru: "Финансовая безответственность", label_uz: "Moliyaviy mas’uliyatsizlik" },
      { id: "controlling", label_ru: "Ревность и контроль", label_uz: "Rashk va nazorat" },
      { id: "disrespect_family", label_ru: "Неуважение к семье", label_uz: "Oilaga hurmatsizlik" },
      { id: "bad_habits", label_ru: "Вредные привычки", label_uz: "Yomon odatlar" },
    ],
  },
  {
    id: "q11_give",
    dimension: "give",
    multi: { min: 1, max: 3 },
    prompt_ru: "Что вы готовы дать в отношениях? (до 3)",
    prompt_uz: "Munosabatlarda nimani berishga tayyorsiz? (3 tagacha)",
    options: [
      { id: "support", label_ru: "Поддержку", label_uz: "Qo‘llab-quvvatlash" },
      { id: "loyalty", label_ru: "Верность", label_uz: "Sadoqat" },
      { id: "stability", label_ru: "Стабильность", label_uz: "Barqarorlik" },
      { id: "care", label_ru: "Заботу", label_uz: "G‘amxo‘rlik" },
      { id: "growth", label_ru: "Развитие", label_uz: "Rivojlanish" },
      { id: "calm", label_ru: "Спокойствие", label_uz: "Xotirjamlik" },
      { id: "responsibility", label_ru: "Ответственность", label_uz: "Mas’uliyat" },
    ],
  },
  {
    id: "q12_format",
    dimension: "format",
    prompt_ru: "Какой формат знакомства вам ближе?",
    prompt_uz: "Qanday tanishuv formati sizga yaqinroq?",
    options: [
      { id: "manual", label_ru: "Сам/сама выбираю из анкет", label_uz: "Anketalardan o‘zim tanlayman" },
      { id: "recommendations", label_ru: "Хочу, чтобы система рекомендовала лучших", label_uz: "Tizim eng yaxshilarini tavsiya qilsin" },
      { id: "compatibility", label_ru: "Хочу видеть совместимость в процентах", label_uz: "Moslikni foizda ko‘rishni xohlayman" },
      { id: "private", label_ru: "Хочу более приватный формат", label_uz: "Maxfiyroq format" },
    ],
  },
];
