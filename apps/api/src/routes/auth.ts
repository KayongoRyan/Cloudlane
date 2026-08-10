import { Router } from 'express';
import * as jwt from 'jsonwebtoken';
import config from '../config';
import { User } from '../models';

const router = Router();

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || user.passwordHash !== password) {
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
