import { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  // Never leak stack traces or SQL details to real users.
  return res.status(err.status || 500).json({ error: 'Something went wrong' });
};

export const notFound = (_req: Request, res: Response) => {
  return res.status(404).json({ error: 'Not found' });
};
