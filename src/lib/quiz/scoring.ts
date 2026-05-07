import { QUIZ_QUESTIONS } from "./questions";

export interface QuizAnswerMap {
  [questionId: string]: string | string[];
}

export interface QuizResult {
  intention_type: string;
  relationship_tempo: string;
  communication_style: string;
  family_values_score: number;
  conflict_style: string;
  privacy_preference: string;
  match_priority_score: number;
  raw_dimensions: Record<string, string | string[]>;
}

const INTENTION_LABELS: Record<string, string> = {
  marriage: "брак",
  serious: "серьёзное знакомство",
  communication: "осторожное серьёзное общение",
  exploring: "исследую",
};

const TEMPO_LABELS: Record<string, string> = {
  week: "быстрый",
  few_weeks: "умеренный",
  month: "спокойный",
  long: "медленный",
};

const COMM_LABELS: Record<string, string> = {
  lots: "интенсивный",
  regular: "размеренный",
  meaningful: "вдумчивый",
  calls: "голосовой",
};

const CONFLICT_LABELS: Record<string, string> = {
  discuss: "прямой диалог",
  cool_down: "пауза перед обсуждением",
  avoid: "избегание",
  wait_first: "ожидание первого шага",
};

const FORMAT_LABELS: Record<string, string> = {
  manual: "ручной выбор",
  recommendations: "рекомендации системы",
  compatibility: "по совместимости",
  private: "приватный",
};

export function computeQuizResult(answers: QuizAnswerMap): QuizResult {
  const get = (id: string) => answers[id];

  const intention = String(get("q1_intention") ?? "exploring");
  const tempo = String(get("q2_tempo") ?? "month");
  const comm = String(get("q6_communication") ?? "regular");
  const conflict = String(get("q5_conflict") ?? "discuss");
  const format = String(get("q12_format") ?? "recommendations");

  const values = (get("q4_values") as string[] | undefined) ?? [];
  const familyValuesScore =
    (values.includes("family") ? 1 : 0) +
    (values.includes("respect") ? 1 : 0) +
    (values.includes("stability") ? 1 : 0) +
    (values.includes("shared_values") ? 1 : 0);

  // simple match priority: serious intention + family values + tempo not "long"
  let priority = 0;
  if (["marriage", "serious"].includes(intention)) priority += 2;
  if (familyValuesScore >= 2) priority += 1;
  if (["week", "few_weeks", "month"].includes(tempo)) priority += 1;

  const raw: Record<string, string | string[]> = {};
  for (const q of QUIZ_QUESTIONS) {
    const a = answers[q.id];
    if (a !== undefined) raw[q.dimension] = a;
  }

  return {
    intention_type: INTENTION_LABELS[intention] ?? intention,
    relationship_tempo: TEMPO_LABELS[tempo] ?? tempo,
    communication_style: COMM_LABELS[comm] ?? comm,
    family_values_score: familyValuesScore,
    conflict_style: CONFLICT_LABELS[conflict] ?? conflict,
    privacy_preference: FORMAT_LABELS[format] ?? format,
    match_priority_score: priority,
    raw_dimensions: raw,
  };
}
