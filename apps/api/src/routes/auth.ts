import { Router } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config';
import { Tenant, User } from '../models';

const router = Router();

router.post('/register', async (req, res) => {
    const { email, password, organization } = req.body;

    if (!email || !password || !organization) {
        return res.status(400).json({ error: 'Email, password and organization are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const tenant = await Tenant.create({
        name: organization,
        slug: `${organization.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        ownerId: 'pending',
        tier: 'free',
        status: 'active',
    });

    const user = await User.create({
        tenantId: tenant._id.toString(),
        email,
        passwordHash: hashedPassword,
        role: 'admin',
    });

    tenant.ownerId = user._id.toString();
    await tenant.save();

    const secret = config.jwtSecret as unknown as jwt.Secret;
    const signOptions = { expiresIn: config.jwtExpiresIn } as jwt.SignOptions;
    const token = jwt.sign(
        { userId: user._id.toString(), tenantId: user.tenantId, role: user.role },
        secret,
        signOptions
    );

    return res.status(201).json({ token });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
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
            userId: user._id.toString(),
            tenantId: user.tenantId,
            role: user.role,
        },
        secret,
        signOptions
    );

    return res.json({ token });
});

export default router;
