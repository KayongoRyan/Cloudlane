import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { User } from '../models';

export interface AuthRequest extends Request<Record<string, any>, any, any> {
  userId?: string;
  tenantId?: string;
  userRole?: string;
}

export async function authenticateJWT(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      tenantId: string;
      role: string;
    };

    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;

    // Verify user still exists
    const user = await User.findOne({ _id: decoded.userId, tenantId: decoded.tenantId });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// API Key authentication for CLI
export async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Missing API key' });
    return;
  }

  try {
    const { hashApiKey } = await import('../services/utils');
    const keyHash = hashApiKey(apiKey);
    const prefix = apiKey.substring(0, 8);

    const apiKeyRecord = await import('../models').then(m =>
      m.ApiKey.findOne({ prefix, keyHash }).populate('tenantId')
    );

    if (!apiKeyRecord) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Update last used timestamp
    await import('../models').then(m =>
      m.ApiKey.updateOne({ _id: apiKeyRecord._id }, { lastUsedAt: new Date() })
    );

    req.tenantId = apiKeyRecord.tenantId;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
}
