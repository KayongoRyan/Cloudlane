import { Router } from 'express';
import jwt from 'jsonwebtoken';
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

    const token = jwt.sign(
        {
            userId: user._id.toString(),
            tenantId: user.tenantId,
            role: user.role,
        },
        config.jwtSecret,
        {
            expiresIn: config.jwtExpiresIn,
        }
    );

    return res.json({ token });
});

export default router;
