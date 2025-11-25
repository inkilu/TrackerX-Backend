import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import subscriptionRoutes from './routes/subscription.routes';
import { errorHandler } from './middleware/error.middleware';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/subscriptions', subscriptionRoutes);

app.get('/', (req, res) => res.send('Subscriptions service running'));

app.use(errorHandler);

export default app;
