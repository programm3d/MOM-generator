import express from 'express';
import cors from 'cors';
import routes from './routes/generation.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { config } from './config/index.js';

export const app = express();

app.use(cors({
  origin: [config.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register API routes
app.use('/api', routes);

// Central error handler
app.use(errorHandler);
