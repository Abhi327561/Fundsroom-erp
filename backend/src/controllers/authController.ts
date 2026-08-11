import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 2. Look up the user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      // Deliberately vague message — never reveal whether it was the
      // email or password that was wrong. That's a security best practice.
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3. Compare the submitted password against the stored hash
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 4. Build the JWT — this is what proves "I'm logged in" on future requests
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'] }
    );

    // 5. Send token + basic user info back (never send password_hash!)
    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong during login' });
  }
};
