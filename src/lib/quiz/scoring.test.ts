import { describe, it, expect } from "vitest";
import { computeQuizResult, type QuizAnswerMap } from "./scoring";

const fullAnswers: QuizAnswerMap = {
  q1_intention: "marriage",
  q2_tempo: "few_weeks",
  q3_roles: "equal",
  q4_values: ["family", "respect", "stability"],
  q5_conflict: "discuss",
  q6_communication: "regular",
  q7_scenario: "chat_then_meet",
  q8_family_role: "after_serious",
  q9_future: "family_kids",
  q10_red_flags: ["lies", "rude"],
  q11_give: ["loyalty", "support"],
  q12_format: "recommendations",
};

describe("computeQuizResult", () => {
  it("translates intention id to label", () => {
    const r = computeQuizResult(fullAnswers);
    expect(r.intention_type).toBe("брак");
  });

  it("counts family values score correctly", () => {
    const r = computeQuizResult(fullAnswers);
    // family + respect + stability = 3 of the 4 trackable values
    expect(r.family_values_score).toBe(3);
  });

  it("priority increases with serious intention + family values + non-slow tempo", () => {
    const r = computeQuizResult(fullAnswers);
    // serious intention (+2) + family >=2 (+1) + tempo few_weeks (+1) = 4
    expect(r.match_priority_score).toBe(4);
  });

  it("low priority for exploring intention + slow tempo", () => {
    const r = computeQuizResult({
      ...fullAnswers,
      q1_intention: "exploring",
      q2_tempo: "long",
      q4_values: ["love"],
    });
    expect(r.match_priority_score).toBe(0);
  });

  it("falls back to defaults when answer missing", () => {
    const r = computeQuizResult({});
    expect(r.intention_type).toBe("исследую");
    expect(r.relationship_tempo).toBe("спокойный");
    expect(r.family_values_score).toBe(0);
  });

  it("preserves raw_dimensions keyed by question dimension", () => {
    const r = computeQuizResult(fullAnswers);
    expect(r.raw_dimensions.intention).toBe("marriage");
    expect(r.raw_dimensions.values).toEqual(["family", "respect", "stability"]);
  });
});
