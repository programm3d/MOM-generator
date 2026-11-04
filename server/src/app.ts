import express from 'express';
import cors from 'cors';
import routes from './routes/generation.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { config } from './config/index.js';

export const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RFC 9110 Allow header for compliance with HTTP method checking
app.use((_req, res, next) => {
  res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS, HEAD');
  next();
});

// Register API routes
app.use('/api', routes);

// Central error handler
app.use(errorHandler);
