const { z } = require('zod');

const listListenersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  availability: z.enum(['ONLINE', 'OFFLINE', 'BUSY']).optional(),
  category: z.string().optional(),
  language: z.string().optional(),
});

const updateAvailabilitySchema = z.object({
  availability: z.enum(['ONLINE', 'OFFLINE', 'BUSY']),
});

const updateWelcomeMessageSchema = z.object({
  welcomeMessage: z
    .string()
    .trim()
    .max(500, 'Welcome message cannot exceed 500 characters'),
});

const listenerUserParamSchema = z.object({
  userId: z.string().min(10),
});

const submitOnboardingSchema = z.object({
  onboardingData: z.record(z.any()).optional(),
  selectedName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().min(2).max(80).optional(),
  dateOfBirth: z.string().trim().min(4).max(32).optional(),
  education: z.string().trim().max(180).optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  experienceCategories: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  experienceReason: z.string().trim().max(180).optional(),
  experienceStory: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),
  profileImageRef: z.string().trim().max(1024).optional(),
  governmentIdType: z.string().trim().max(120).optional(),
  governmentIdImageRef: z.string().trim().max(1024).optional(),
});

module.exports = {
  listListenersQuerySchema,
  updateAvailabilitySchema,
  updateWelcomeMessageSchema,
  listenerUserParamSchema,
  submitOnboardingSchema,
};
