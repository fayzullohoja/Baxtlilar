import { describe, it, expect } from "vitest";
import {
  basicProfileSchema,
  educationSchema,
  familySchema,
  valuesSchema,
  lookingForSchema,
  aboutSchema,
  ageFromDob,
} from "./schemas";

describe("ageFromDob", () => {
  it("computes age from DOB", () => {
    const today = new Date();
    const dob = `${today.getFullYear() - 30}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(ageFromDob(dob)).toBe(30);
  });
  it("returns 0 for invalid date", () => {
    expect(ageFromDob("not-a-date")).toBe(0);
  });
});

describe("basicProfileSchema", () => {
  const valid = {
    display_name: "Анора",
    birth_date: "1995-04-15",
    gender: "female" as const,
    city: "Ташкент",
    district: "Юнусабад",
    marital_status: "never_married" as const,
    currently_married: "no" as const,
  };
  it("accepts valid profile", () => {
    expect(basicProfileSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects under-18", () => {
    const today = new Date();
    const r = basicProfileSchema.safeParse({
      ...valid,
      birth_date: `${today.getFullYear() - 17}-01-01`,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === "min_age")).toBe(true);
    }
  });
  it("rejects empty display_name", () => {
    expect(
      basicProfileSchema.safeParse({ ...valid, display_name: "" }).success,
    ).toBe(false);
  });
});

describe("educationSchema", () => {
  it("requires education_level, work_industry, employment_status, financial_stability", () => {
    const r = educationSchema.safeParse({
      education_level: "",
      work_industry: "",
      profession: "",
      employment_status: "",
      financial_stability: "",
    });
    expect(r.success).toBe(false);
  });
  it("profession is optional", () => {
    const r = educationSchema.safeParse({
      education_level: "bachelor",
      work_industry: "it",
      profession: "",
      employment_status: "working",
      financial_stability: "stable",
    });
    expect(r.success).toBe(true);
  });
});

describe("familySchema", () => {
  it("all 4 fields required", () => {
    const r = familySchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe("valuesSchema", () => {
  it("interests min 1 max 5", () => {
    const base = {
      religiosity_level: "moderate",
      smoking_status: "no",
      alcohol_status: "no",
    };
    expect(valuesSchema.safeParse({ ...base, interests: [] }).success).toBe(false);
    expect(
      valuesSchema.safeParse({ ...base, interests: ["a", "b", "c", "d", "e", "f"] }).success,
    ).toBe(false);
    expect(valuesSchema.safeParse({ ...base, interests: ["family"] }).success).toBe(true);
  });
});

describe("lookingForSchema", () => {
  const valid = {
    looking_for_gender: "male",
    preferred_age_min: 25,
    preferred_age_max: 40,
    preferred_city_scope: "tashkent",
    preferred_marital_status: "any",
    preferred_children_status: "any",
    preferred_partner_qualities: ["respect_parents", "kindness", "honesty"],
  };
  it("accepts valid", () => {
    expect(lookingForSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects max < min age", () => {
    const r = lookingForSchema.safeParse({ ...valid, preferred_age_min: 50, preferred_age_max: 30 });
    expect(r.success).toBe(false);
  });
  it("rejects fewer than 3 qualities", () => {
    const r = lookingForSchema.safeParse({ ...valid, preferred_partner_qualities: ["a", "b"] });
    expect(r.success).toBe(false);
  });
});

describe("aboutSchema", () => {
  it("rejects short about_me", () => {
    const r = aboutSchema.safeParse({
      about_me: "слишком коротко",
      marriage_values_text: "уважение спокойствие поддержка общие цели развитие",
    });
    expect(r.success).toBe(false);
  });
  it("accepts long enough texts", () => {
    const r = aboutSchema.safeParse({
      about_me: "Я живу в Ташкенте, работаю в IT-компании и больше всего ценю в людях честность и спокойствие, ищу серьёзные отношения.",
      marriage_values_text: "Уважение, спокойствие, поддержка, общие ценности, желание создать семью и развиваться вместе.",
    });
    expect(r.success).toBe(true);
  });
});
