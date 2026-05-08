// Pre-filled rejection reasons. Picking a kind auto-suggests a reason
// shown to the user; moderator can edit before sending.

export interface RejectionTemplate {
  kind: string;
  label: string;
  reason: string;
  /** which document(s) the user should re-upload */
  retake: "passport" | "selfie" | "both";
}

export const REJECTION_TEMPLATES: RejectionTemplate[] = [
  {
    kind: "document_unreadable",
    label: "Паспорт нечитаемый",
    reason:
      "Фото паспорта размыто или часть данных не видна. Пожалуйста, переснимите страницу с фото при хорошем освещении.",
    retake: "passport",
  },
  {
    kind: "wrong_document",
    label: "Не паспорт",
    reason:
      "Загруженный документ не является паспортом. Пожалуйста, загрузите главную страницу паспорта (с фото и данными).",
    retake: "passport",
  },
  {
    kind: "face_not_visible",
    label: "Лицо на selfie не видно",
    reason:
      "На фото-selfie не видно лица или оно частично закрыто. Пожалуйста, переснимите фронтальное selfie при хорошем освещении.",
    retake: "selfie",
  },
  {
    kind: "selfie_mismatch",
    label: "Selfie не совпадает",
    reason:
      "Лицо на selfie не совпадает с фото в паспорте. Пожалуйста, убедитесь, что selfie снято вами, и переснимите.",
    retake: "selfie",
  },
  {
    kind: "policy_violation",
    label: "Подделка / нарушение",
    reason:
      "Документ выглядит подделанным или нарушает правила сервиса. Если это ошибка — обратитесь в поддержку.",
    retake: "both",
  },
  {
    kind: "other",
    label: "Другая причина",
    reason: "",
    retake: "both",
  },
];
