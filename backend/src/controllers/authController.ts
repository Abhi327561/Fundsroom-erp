import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, toClient, isId } from '../models/store';
import { env } from '../config/env';

const toPublicUser = (u: any) => ({ id: String(u._id ?? u.id), name: u.name, email: u.email, role: u.role });

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation (detailed shape already checked by express-validator)
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Look up the user by email (case-insensitive — stored lowercase)
    const user = await User.findOne({ email: normalizedEmail });
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
      { id: String(user._id), email: user.email, role: user.role },
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

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, password_hash: passwordHash, role });
    return res.status(201).json({ data: toPublicUser(user) });
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

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, password_hash: passwordHash, role: safeRole });
    const token = jwt.sign(
      { id: String(user._id), email: user.email, role: user.role },
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
    const user = await User.findById(req.user!.id, { password_hash: 0 }).lean();
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    return res.status(200).json({ data: toClient(user) });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
};

// GET /auth/users — admin lists all users.
export const listUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find({}, { password_hash: 0 }).sort({ created_at: 1 }).lean();
    return res.status(200).json({ data: users.map(toClient) });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'Failed to load users' });
  }
};

// POST /auth/change-password — real users rotate their own passwords.
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password_hash = await bcrypt.hash(newPassword, 12);
    await user.save();
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
    const targetId = req.params.id;
    const { role } = req.body;
    if (!isId(targetId)) return res.status(404).json({ error: 'User not found' });

    if (req.user!.id === targetId && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }

    const user = await User.findByIdAndUpdate(targetId, { role }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ data: toPublicUser(user) });
  } catch (err) {
    console.error('updateUserRole error:', err);
    return res.status(500).json({ error: 'Failed to update role' });
  }
};
