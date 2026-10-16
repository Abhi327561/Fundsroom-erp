import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { env } from '../config/env';

const toPublicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation (detailed shape already checked by express-validator)
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Look up the user by email
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
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
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    // 5. Send token + basic user info back (never send password_hash!)
    return res.status(200).json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong during login' });
  }
};

// POST /auth/register — admin creates real users, including other admins. Never open-signup in an ERP.
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const exists = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role`,
      [String(name).trim(), normalizedEmail, passwordHash, role]
    );
    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
};

// POST /auth/signup — public self-registration. Admin role is NEVER self-selectable;
// only an existing admin can promote someone via PATCH /auth/users/:id/role.
export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const safeRole = String(role);

    if (safeRole === 'admin') {
      return res.status(403).json({ error: 'Admin role can only be granted by an existing admin' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role`,
      [String(name).trim(), normalizedEmail, passwordHash, safeRole]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );
    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }
};

// GET /auth/me — frontend validates the stored token on boot.
export const me = async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user!.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
};

// GET /auth/users — admin lists all users.
export const listUsers = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC');
    return res.status(200).json({ data: result.rows });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'Failed to load users' });
  }
};

// POST /auth/change-password — real users rotate their own passwords.
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user!.id]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
    return res.status(200).json({ message: 'Password changed' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

// PATCH /auth/users/:id/role — ONLY admins can grant/revoke roles (including admin).
// Guards: cannot demote yourself (prevents accidental lockout with zero admins).
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { role } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Invalid user id' });

    if (req.user!.id === targetId && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE id = $1', [targetId]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, targetId]
    );
    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('updateUserRole error:', err);
    return res.status(500).json({ error: 'Failed to update role' });
  }
};
