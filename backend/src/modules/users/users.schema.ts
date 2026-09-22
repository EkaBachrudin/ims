import { z } from "zod";

const roleEnum = z.enum(["SUPER_ADMIN", "ADMIN", "OWNER"]);

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    role: roleEnum.optional(),
    q: z.string().trim().optional(),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    role: roleEnum.default("ADMIN"),
    telegramId: z.string().trim().min(1).nullable().optional(),
    whatsappNumber: z.string().trim().min(1).nullable().optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    name: z.string().min(1).optional(),
    role: roleEnum.optional(),
    telegramId: z.string().trim().min(1).nullable().optional(),
    whatsappNumber: z.string().trim().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
