import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pool from './src/config/db.js';
import cookieParser from 'cookie-parser';
import { authenticateToken } from './src/middleware/authenticateToken.js';
import { signup, login, refresh, logout } from './src/modules/auth/authController.js';

dotenv.config();

const app = express();

app.use(cors({
    origin: "http://localhost:5173"
}));
app.use(express.json())

app.use(cookieParser());

app.post('/api/signup', signup);
app.post('/api/login', login);
app.post('/api/refresh', refresh);
app.post('/api/logout', logout);

app.get('/api/test-protected', authenticateToken, (req, res) => {
    res.status(200).json({
        message: `You are authenticated as ${req.user.username}`,
        user: req.user
    });
});

app.get('/home', async (req, res) => {
    try{
        const [row] = await pool.query('SELECT 1 + 3 AS result');
        res.json({
            status: "ok",
            db_result: row[0].result
        });
    }catch(err){
        console.error(err);
        res.status(500).json({
            status: "not okay",
            message: err.message
        });
    }
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))