import express from 'express';
import cors from 'express';
import 'dotenv/config';
import path from 'path';
import authRoutes from './routes/authRoutes';
import medicineRoutes from './routes/medicineRoutes';
import reminderRoutes from './routes/reminderRoutes';
import refillRoutes from './routes/refillRoutes';

const app = express();

// Middleware
const corsMiddleware = require('cors');
app.use(corsMiddleware());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/refills', refillRoutes);

app.get('/', (req, res) => {
  res.send('MediMate AI API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
