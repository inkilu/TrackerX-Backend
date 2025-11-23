import mongoose, { Schema, Document } from 'mongoose';

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

export interface ISubscription extends Document {
    userId: string;
    name: string;
    description?: string;
    firstDate: Date;
    repeatsEvery: number;
    repeatsUnit: RepeatUnit;
    amount: number;
    currency?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SubscriptionSchema: Schema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        description: { type: String },
        firstDate: { type: Date, required: true },
        repeatsEvery: { type: Number, required: true, min: 1 },
        repeatsUnit: {
            type: String,
            required: true,
            enum: ['day', 'week', 'month', 'year'],
        },
        amount: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
    },
    { timestamps: true }
);

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
