import { Response } from 'express';
import { Subscription } from '../models/subscription.model';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

// Create
export const createSubscription = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { name, description, firstDate, repeatsEvery, repeatsUnit, amount, currency } = req.body;

  const sub = await Subscription.create({
    userId: uid,
    name,
    description,
    firstDate,
    repeatsEvery,
    repeatsUnit,
    amount,
    currency,
  });

  res.status(201).json(sub);
});

// Update
export const updateSubscription = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const id = req.params.id;

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });

  const sub = await Subscription.findOne({ _id: id, userId: uid });
  if (!sub) return res.status(404).json({ message: 'Subscription not found' });

  const fields = ['name', 'description', 'firstDate', 'repeatsEvery', 'repeatsUnit', 'amount', 'currency'];
  fields.forEach((key) => {
    if ((req.body as any)[key] !== undefined) (sub as any)[key] = (req.body as any)[key];
  });

  await sub.save();
  res.json(sub);
});

// Delete
export const deleteSubscription = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const id = req.params.id;

  const sub = await Subscription.findOneAndDelete({ _id: id, userId: uid });
  if (!sub) return res.status(404).json({ message: 'Subscription not found' });

  res.json({ message: 'Deleted' });
});

// Get single
export const getSubscription = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const id = req.params.id;

  const sub = await Subscription.findOne({ _id: id, userId: uid });
  if (!sub) return res.status(404).json({ message: 'Subscription not found' });

  res.json(sub);
});

// List
export const listSubscriptions = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const page = Math.max(1, parseInt((req.query.page as string) || '1'));
  const limit = Math.min(100, parseInt((req.query.limit as string) || '20'));

  const filter: any = { userId: uid };

  if (req.query.name) {
    filter.name = { $regex: String(req.query.name), $options: 'i' };
  }

  const total = await Subscription.countDocuments(filter);
  const items = await Subscription.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ total, page, limit, items });
});
