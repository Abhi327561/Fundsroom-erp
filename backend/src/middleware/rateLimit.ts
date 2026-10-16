import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public signup is stricter — prevents mass fake-account creation.
export const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many signup attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
