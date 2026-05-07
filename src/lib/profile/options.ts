export interface Option {
  id: string;
  ru: string;
  uz: string;
}

export const EDUCATION_LEVELS: Option[] = [
  { id: "secondary", ru: "Среднее", uz: "O‘rta" },
  { id: "secondary_special", ru: "Среднее специальное", uz: "O‘rta maxsus" },
  { id: "bachelor", ru: "Высшее", uz: "Oliy" },
  { id: "master", ru: "Магистратура / PhD", uz: "Magistratura / PhD" },
  { id: "other", ru: "Другое", uz: "Boshqa" },
];

export const WORK_INDUSTRIES: Option[] = [
  { id: "business", ru: "Бизнес", uz: "Biznes" },
  { id: "gov", ru: "Госслужба", uz: "Davlat xizmati" },
  { id: "finance", ru: "Банк / финансы", uz: "Bank / moliya" },
  { id: "it", ru: "IT", uz: "IT" },
  { id: "education", ru: "Образование", uz: "Ta’lim" },
  { id: "medicine", ru: "Медицина", uz: "Tibbiyot" },
  { id: "trade", ru: "Торговля", uz: "Savdo" },
  { id: "service", ru: "Сервис", uz: "Xizmat" },
  { id: "production", ru: "Производство", uz: "Ishlab chiqarish" },
  { id: "unemployed", ru: "Не работаю", uz: "Ishlamayapman" },
  { id: "other", ru: "Другое", uz: "Boshqa" },
];

export const EMPLOYMENT_STATUSES: Option[] = [
  { id: "working", ru: "Работаю", uz: "Ishlayapman" },
  { id: "studying", ru: "Учусь", uz: "O‘qiyapman" },
  { id: "both", ru: "Работаю и учусь", uz: "Ishlayapman va o‘qiyapman" },
  { id: "entrepreneur", ru: "Предприниматель", uz: "Tadbirkor" },
  { id: "between", ru: "Временно не работаю", uz: "Vaqtincha ishlamayapman" },
];

export const FINANCIAL_STABILITY: Option[] = [
  { id: "stable", ru: "Стабилен/стабильна", uz: "Barqaror" },
  { id: "growing", ru: "В процессе роста", uz: "O‘sish jarayonida" },
  { id: "unstable", ru: "Пока нестабильно, но работаю над этим", uz: "Hozir barqaror emas, lekin ish olib boryapman" },
  { id: "skip", ru: "Предпочитаю не указывать", uz: "Ko‘rsatmaslikni tanlayman" },
];

export const HAS_CHILDREN: Option[] = [
  { id: "no", ru: "Нет", uz: "Yo‘q" },
  { id: "yes_with_me", ru: "Да, живут со мной", uz: "Ha, men bilan yashaydi" },
  { id: "yes_separate", ru: "Да, не живут со мной", uz: "Ha, men bilan yashamaydi" },
  { id: "discuss", ru: "Предпочитаю обсудить лично", uz: "Shaxsan muhokama qilishni xohlayman" },
];

export const WANTS_CHILDREN: Option[] = [
  { id: "yes", ru: "Да", uz: "Ha" },
  { id: "no", ru: "Нет", uz: "Yo‘q" },
  { id: "maybe", ru: "Возможно", uz: "Balki" },
  { id: "depends", ru: "Зависит от партнёра", uz: "Sherikga bog‘liq" },
  { id: "have_no_more", ru: "Уже есть дети, больше не планирую", uz: "Bor, ko‘proq rejalashtirmayapman" },
];

export const MARRIAGE_TIMELINE: Option[] = [
  { id: "year", ru: "В ближайший год", uz: "Yaqin bir yilda" },
  { id: "1_2_years", ru: "В течение 1–2 лет", uz: "1–2 yil ichida" },
  { id: "when_found", ru: "Когда найду подходящего человека", uz: "Mos odam topganimda" },
  { id: "exploring", ru: "Пока хочу серьёзно познакомиться", uz: "Hozircha jiddiy tanishmoqchiman" },
];

export const RELOCATION: Option[] = [
  { id: "ready", ru: "Готов/готова переехать", uz: "Ko‘chishga tayyor" },
  { id: "city_only", ru: "Только в пределах города", uz: "Faqat shahar ichida" },
  { id: "country_only", ru: "Только в пределах Узбекистана", uz: "Faqat O‘zbekiston ichida" },
  { id: "no", ru: "Не готов/не готова", uz: "Tayyor emas" },
];

export const RELIGIOSITY: Option[] = [
  { id: "observant", ru: "Соблюдаю", uz: "Amal qilaman" },
  { id: "trying", ru: "Стараюсь соблюдать", uz: "Amal qilishga harakat qilaman" },
  { id: "moderate", ru: "Умеренно", uz: "O‘rtacha" },
  { id: "skip", ru: "Не хочу указывать", uz: "Ko‘rsatishni xohlamayman" },
];

export const SMOKING: Option[] = [
  { id: "no", ru: "Не курю", uz: "Chekmayman" },
  { id: "yes", ru: "Курю", uz: "Chekaman" },
  { id: "sometimes", ru: "Иногда", uz: "Ba’zan" },
  { id: "skip", ru: "Не хочу указывать", uz: "Ko‘rsatishni xohlamayman" },
];

export const ALCOHOL: Option[] = [
  { id: "no", ru: "Не употребляю", uz: "Iste’mol qilmayman" },
  { id: "rare", ru: "Редко", uz: "Kamdan-kam" },
  { id: "yes", ru: "Употребляю", uz: "Iste’mol qilaman" },
  { id: "skip", ru: "Не хочу указывать", uz: "Ko‘rsatishni xohlamayman" },
];

export const INTERESTS: Option[] = [
  { id: "family", ru: "Семья", uz: "Oila" },
  { id: "sport", ru: "Спорт", uz: "Sport" },
  { id: "books", ru: "Книги", uz: "Kitoblar" },
  { id: "travel", ru: "Путешествия", uz: "Sayohatlar" },
  { id: "business", ru: "Бизнес", uz: "Biznes" },
  { id: "restaurants", ru: "Рестораны / кафе", uz: "Restoranlar / kafe" },
  { id: "nature", ru: "Природа", uz: "Tabiat" },
  { id: "education", ru: "Образование", uz: "Ta’lim" },
  { id: "culture", ru: "Культура", uz: "Madaniyat" },
  { id: "volunteering", ru: "Волонтёрство", uz: "Ko‘ngillilik" },
  { id: "other", ru: "Другое", uz: "Boshqa" },
];

export const LOOKING_CITY_SCOPE: Option[] = [
  { id: "tashkent", ru: "Ташкент", uz: "Toshkent" },
  { id: "other_cities", ru: "Другие города", uz: "Boshqa shaharlar" },
  { id: "open", ru: "Готов/готова рассмотреть другой город", uz: "Boshqa shaharni ko‘rib chiqishga tayyorman" },
];

export const LOOKING_MARITAL: Option[] = [
  { id: "never_married", ru: "Не был/не была в браке", uz: "Hech qachon turmushga chiqmagan/uylanmagan" },
  { id: "divorced", ru: "Разведён/разведена", uz: "Ajrashgan" },
  { id: "widowed", ru: "Вдовец/вдова", uz: "Beva" },
  { id: "any", ru: "Не имеет значения", uz: "Ahamiyati yo‘q" },
];

export const LOOKING_CHILDREN: Option[] = [
  { id: "without", ru: "Без детей", uz: "Farzandsiz" },
  { id: "with_kids_ok", ru: "Можно с детьми", uz: "Farzandlar bilan ham mumkin" },
  { id: "any", ru: "Не имеет значения", uz: "Ahamiyati yo‘q" },
];

export const PARTNER_QUALITIES: Option[] = [
  { id: "responsibility", ru: "Ответственность", uz: "Mas’uliyat" },
  { id: "family_oriented", ru: "Семейность", uz: "Oilaviylik" },
  { id: "values", ru: "Религиозность / ценности", uz: "Diniylik / qadriyatlar" },
  { id: "education", ru: "Образование", uz: "Ta’lim" },
  { id: "financial", ru: "Финансовая стабильность", uz: "Moliyaviy barqarorlik" },
  { id: "kindness", ru: "Доброта", uz: "Mehribonlik" },
  { id: "calm", ru: "Спокойный характер", uz: "Xotirjam xarakter" },
  { id: "ambitious", ru: "Амбициозность", uz: "Maqsadparvarlik" },
  { id: "respect_parents", ru: "Уважение к родителям", uz: "Ota-onaga hurmat" },
  { id: "ready_marry", ru: "Готовность к браку", uz: "Nikohga tayyorlik" },
  { id: "honesty", ru: "Честность", uz: "Halollik" },
  { id: "communication", ru: "Умение общаться", uz: "Muloqot qilish qobiliyati" },
];

export function pick<T extends { id: string }>(list: T[], id: string | null | undefined): T | undefined {
  return id ? list.find((o) => o.id === id) : undefined;
}
