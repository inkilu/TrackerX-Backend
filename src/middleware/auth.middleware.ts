import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    } as any),
  });
}

export interface AuthedRequest extends Request {
  uid?: string;
}

export const firebaseAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }
    const idToken = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error('Firebase auth error', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
};
