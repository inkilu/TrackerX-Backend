import { Request, Response } from 'express';
import { Subscription } from '../models/subscription.model';
import { AuthedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Add n units to a date (supports day/week/month/year)
 */
function addUnits(date: Date, n: number, unit: 'day' | 'week' | 'month' | 'year') {
    const d = new Date(date);
    if (unit === 'day') d.setDate(d.getDate() + n);
    else if (unit === 'week') d.setDate(d.getDate() + 7 * n);
    else if (unit === 'month') d.setMonth(d.getMonth() + n);
    else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
    return d;
}

/**
 * Count occurrences of a repeating event between [periodStart, periodEnd]
 * starting at firstDate, repeating every `repeatsEvery` units of `repeatsUnit`.
 * Occurrences exactly on periodStart/periodEnd are counted.
 */
function countOccurrencesBetween(
    firstDate: Date,
    repeatsEvery: number,
    repeatsUnit: 'day' | 'week' | 'month' | 'year',
    periodStart: Date,
    periodEnd: Date
) {
    if (firstDate > periodEnd) return 0;

    // If firstDate is inside the window, start from firstDate
    // Otherwise, compute the earliest occurrence >= periodStart.

    // Handle day & week using arithmetic
    if (repeatsUnit === 'day' || repeatsUnit === 'week') {
        const msPerDay = 1000 * 60 * 60 * 24;
        const unitDays = repeatsUnit === 'day' ? repeatsEvery : repeatsEvery * 7;

        // find index of first occurrence >= periodStart
        const diffDays = Math.floor((periodStart.getTime() - firstDate.getTime()) / msPerDay);
        const firstIndex = diffDays <= 0 ? 0 : Math.ceil(diffDays / unitDays);
        const firstOccur = addUnits(firstDate, firstIndex * unitDays, 'day');

        if (firstOccur > periodEnd) return 0;

        const diffDaysEnd = Math.floor((periodEnd.getTime() - firstOccur.getTime()) / msPerDay);
        const count = Math.floor(diffDaysEnd / unitDays) + 1;
        return count;
    }

    // For month & year, iterate safely (but try to fast-forward)
    let curr = new Date(firstDate);

    if (curr < periodStart) {
        // Fast-forward approximation
        if (repeatsUnit === 'month') {
            const totalMonths =
                (periodStart.getFullYear() - curr.getFullYear()) * 12 +
                (periodStart.getMonth() - curr.getMonth());
            const jumps = Math.max(0, Math.floor(totalMonths / repeatsEvery) - 1);
            if (jumps > 0) curr = addUnits(curr, jumps * repeatsEvery, 'month');
        } else if (repeatsUnit === 'year') {
            const totalYears = periodStart.getFullYear() - curr.getFullYear();
            const jumps = Math.max(0, Math.floor(totalYears / repeatsEvery) - 1);
            if (jumps > 0) curr = addUnits(curr, jumps * repeatsEvery, 'year');
        }

        while (curr < periodStart) {
            curr = addUnits(curr, repeatsEvery, repeatsUnit);
        }
    }

    if (curr > periodEnd) return 0;

    let count = 0;
    while (curr <= periodEnd) {
        count += 1;
        curr = addUnits(curr, repeatsEvery, repeatsUnit);
        if (count > 10000) break; // safety guard
    }
    return count;
}

/**
 * Find the next occurrence strictly AFTER the given date (periodEnd).
 * Returns Date | null.
 */
function getNextOccurrenceAfter(
    firstDate: Date,
    repeatsEvery: number,
    repeatsUnit: 'day' | 'week' | 'month' | 'year',
    afterDate: Date
): Date | null {
    // If firstDate is after afterDate, that's the next one
    if (firstDate > afterDate) return new Date(firstDate);

    // For day/week use arithmetic
    if (repeatsUnit === 'day' || repeatsUnit === 'week') {
        const msPerDay = 1000 * 60 * 60 * 24;
        const unitDays = repeatsUnit === 'day' ? repeatsEvery : repeatsEvery * 7;

        const diffDays = Math.floor((afterDate.getTime() - firstDate.getTime()) / msPerDay);
        const nextIndex = Math.floor(diffDays / unitDays) + 1;
        return addUnits(firstDate, nextIndex * unitDays, 'day');
    }

    // month/year: iterate with fast-forward
    let curr = new Date(firstDate);
    if (curr <= afterDate) {
        if (repeatsUnit === 'month') {
            const totalMonths =
                (afterDate.getFullYear() - curr.getFullYear()) * 12 +
                (afterDate.getMonth() - curr.getMonth());
            const jumps = Math.max(0, Math.floor(totalMonths / repeatsEvery) - 1);
            if (jumps > 0) curr = addUnits(curr, jumps * repeatsEvery, 'month');
        } else if (repeatsUnit === 'year') {
            const totalYears = afterDate.getFullYear() - curr.getFullYear();
            const jumps = Math.max(0, Math.floor(totalYears / repeatsEvery) - 1);
            if (jumps > 0) curr = addUnits(curr, jumps * repeatsEvery, 'year');
        }

        let safety = 0;
        while (curr <= afterDate && safety < 10000) {
            curr = addUnits(curr, repeatsEvery, repeatsUnit);
            safety++;
        }
        if (safety >= 10000) return null;
        return curr;
    }

    return curr;
}

/**
 * Controller: compute extended summary
 *
 * Query params:
 * - period=day|week|month|year  AND date=YYYY-MM-DD
 * - OR start=YYYY-MM-DD & end=YYYY-MM-DD
 */
export const getSpendingSummary = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const uid = req.uid!;
    const { period, date, start, end } = req.query as { [k: string]: string | undefined };

    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    if (start && end) {
        periodStart = new Date(start);
        periodEnd = new Date(end);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
    } else if (period) {
        const dt = date ? new Date(date) : new Date();
        if (Number.isNaN(dt.getTime())) {
            return res.status(400).json({ message: "Invalid date" });
        }
        if (period === 'day') {
            periodStart = new Date(dt); periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(dt); periodEnd.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
            // ISO week (Mon - Sun)
            const day = dt.getDay(); // 0 (Sun) - 6
            const diffToMon = ((day + 6) % 7); // days since Monday
            periodStart = new Date(dt); periodStart.setDate(dt.getDate() - diffToMon); periodStart.setHours(0, 0, 0, 0);
            periodEnd = addUnits(periodStart, 6, 'day'); periodEnd.setHours(23, 59, 59, 999);
        } else if (period === 'month') {
            periodStart = new Date(dt.getFullYear(), dt.getMonth(), 1); periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(dt.getFullYear(), dt.getMonth() + 1, 0); periodEnd.setHours(23, 59, 59, 999);
        } else if (period === 'year') {
            periodStart = new Date(dt.getFullYear(), 0, 1); periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(dt.getFullYear(), 11, 31); periodEnd.setHours(23, 59, 59, 999);
        } else {
            return res.status(400).json({ message: 'Invalid period' });
        }
    } else {
        return res.status(400).json({ message: 'Provide either period+date OR start+end query params' });
    }

    // fetch user subs
    const subs = await Subscription.find({ userId: uid });

    let total = 0;
    const breakdown: Array<any> = [];

    for (const s of subs) {
        const firstDate = new Date(s.firstDate);
        const occurrences = countOccurrencesBetween(
            firstDate,
            s.repeatsEvery,
            s.repeatsUnit,
            periodStart!,
            periodEnd!
        );
        const subtotal = occurrences * (s.amount || 0);
        const averagePerOccurrence = occurrences > 0 ? subtotal / occurrences : 0;

        // next due date after periodEnd
        const nextDue = getNextOccurrenceAfter(firstDate, s.repeatsEvery, s.repeatsUnit, periodEnd!);
        const nextDueIso = nextDue ? nextDue.toISOString() : null;

        if (subtotal > 0) {
            breakdown.push({
                subscriptionId: s._id,
                itemName: s.name,
                occurrences,
                amountPerOccurrence: s.amount,
                subtotal,
                averagePerOccurrence,
                nextDueDate: nextDueIso
            });
        } else {
            // still include items with 0 occurrences if you want them listed — here we skip them to keep results concise
            // If you prefer to include zero-occurrence items, comment out the 'if (subtotal > 0)' guard above.
        }

        total += subtotal;
    }

    res.json({
        total,
        periodStart: periodStart!.toISOString(),
        periodEnd: periodEnd!.toISOString(),
        breakdown
    });
});
