import { z } from "zod";

export const basicProfileSchema = z
  .object({
    display_name: z.string().trim().min(2).max(50),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: z.enum(["male", "female"]),
    city: z.string().trim().min(2).max(60),
    district: z.string().trim().max(60).optional().or(z.literal("")),
    marital_status: z.enum(["never_married", "divorced", "widowed"]),
    currently_married: z.enum(["yes", "no"]),
  })
  .refine((d) => ageFromDob(d.birth_date) >= 18, {
    path: ["birth_date"],
    message: "min_age",
  });

export type BasicProfile = z.infer<typeof basicProfileSchema>;

export const educationSchema = z.object({
  education_level: z.string().min(1),
  work_industry: z.string().min(1),
  profession: z.string().trim().max(100).optional().or(z.literal("")),
  employment_status: z.string().min(1),
  financial_stability: z.string().min(1),
});

export const familySchema = z.object({
  has_children: z.string().min(1),
  wants_children: z.string().min(1),
  marriage_timeline: z.string().min(1),
  relocation_readiness: z.string().min(1),
});

export const valuesSchema = z.object({
  religiosity_level: z.string().min(1),
  smoking_status: z.string().min(1),
  alcohol_status: z.string().min(1),
  interests: z.array(z.string()).min(1).max(5),
});

export const lookingForSchema = z.object({
  looking_for_gender: z.enum(["male", "female"]),
  preferred_age_min: z.coerce.number().int().min(18).max(80),
  preferred_age_max: z.coerce.number().int().min(18).max(80),
  preferred_city_scope: z.string().min(1),
  preferred_marital_status: z.string().min(1),
  preferred_children_status: z.string().min(1),
  preferred_partner_qualities: z.array(z.string()).min(3).max(5),
}).refine((d) => d.preferred_age_max >= d.preferred_age_min, {
  path: ["preferred_age_max"],
  message: "age_range",
});

export const aboutSchema = z.object({
  about_me: z.string().trim().min(50).max(500),
  marriage_values_text: z.string().trim().min(30).max(300),
});

export const photoPrivacySchema = z.object({
  photo_privacy_mode: z.enum([
    "public_verified_users",
    "blur_until_match",
    "hidden_until_match",
  ]),
});

export function ageFromDob(dobIso: string): number {
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
