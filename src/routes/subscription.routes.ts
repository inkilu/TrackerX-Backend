import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscription,
  listSubscriptions,
} from '../controllers/subscription.controller';
import { getSpendingSummary } from '../controllers/subscription.summary.controller';
import { firebaseAuth } from '../middleware/auth.middleware';
import { validationResultHandler } from './validation';

const router = express.Router();

const createValidators = [
  body('name').isString().notEmpty(),
  body('firstDate').isISO8601().toDate(),
  body('repeatsEvery').isInt({ min: 1 }),
  body('repeatsUnit').isIn(['day', 'week', 'month', 'year']),
  body('amount').isNumeric(),
];

const updateValidators = [
  param('id').isMongoId(),
  body('firstDate').optional().isISO8601().toDate(),
  body('repeatsEvery').optional().isInt({ min: 1 }),
  body('repeatsUnit').optional().isIn(['day', 'week', 'month', 'year']),
  body('amount').optional().isNumeric(),
];

const summaryValidators = [
  query("period")
    .optional()
    .isIn(["day", "week", "month", "year"]),

  query("date")
    .optional()
    .isISO8601(),

  query("start")
    .optional()
    .isISO8601(),

  query("end")
    .optional()
    .isISO8601()
];


router.get('/summary', firebaseAuth, summaryValidators, validationResultHandler, getSpendingSummary);
router.post('/', firebaseAuth, createValidators, validationResultHandler, createSubscription);
router.get('/', firebaseAuth, listSubscriptions);
router.get('/:id', firebaseAuth, param('id').isMongoId(), validationResultHandler, getSubscription);
router.put('/:id', firebaseAuth, updateValidators, validationResultHandler, updateSubscription);
router.delete('/:id', firebaseAuth, param('id').isMongoId(), validationResultHandler, deleteSubscription);

export default router;
