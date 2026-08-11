import { Router } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config';
import { createUserAndTenant, findUserByEmail } from '../database';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, organization } = req.body as { email?: string; password?: string; organization?: string };

    if (!email || !password || !organization) {
        return res.status(400).json({ error: 'Email, password and organization are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
        return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const slugBase = organization.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organization';
    const user = await createUserAndTenant(organization.trim(), `${slugBase}-${Date.now()}`, normalizedEmail, hashedPassword);

    const secret = config.jwtSecret as unknown as jwt.Secret;
    const signOptions = { expiresIn: config.jwtExpiresIn } as jwt.SignOptions;
    const token = jwt.sign(
        { userId: user.id, tenantId: user.tenantId, role: user.role },
        secret,
        signOptions
    );

    return res.status(201).json({ token });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    console.error('Registration failed:', error);
    return res.status(500).json({ error: 'Unable to create account' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(email.trim().toLowerCase());
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    let isValidPassword = user.passwordHash === password;

    if (!isValidPassword) {
        try {
            isValidPassword = await bcrypt.compare(password, user.passwordHash);
        } catch (err) {
            isValidPassword = false;
        }
    }

    if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = config.jwtSecret as unknown as jwt.Secret;
    const signOptions = { expiresIn: config.jwtExpiresIn } as jwt.SignOptions;

    const token = jwt.sign(
        {
            userId: user.id,
            tenantId: user.tenantId,
            role: user.role,
        },
        secret,
        signOptions
    );

    return res.json({ token });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Unable to sign in' });
  }
});

export default router;
