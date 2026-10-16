import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Returns 400 with the first validation message when express-validator fails.
export const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
