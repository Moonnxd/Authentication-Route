import pool from '../../config/db.js';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { generateAccessToken, generateRefreshToken } from '../../utils/tokens.js';
import jwt from 'jsonwebtoken';

export const signup = async (req, res) => {
    try{
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            username,
            password,
        } = req.body;

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        if(
            !trimmedUsername ||
            !trimmedPassword
        ){
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const [existing] = await pool.query(
            "SELECT username FROM users WHERE username = ?",
            [trimmedUsername]
        )

        if(existing.length > 0){
            return res.status(400).json({
                message: "Username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

        const [userResult] = await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [trimmedUsername, hashedPassword, "customer"]
        );

        res.status(201).json({
            message: "Signup succesfully"
        });
    }catch (err){
        console.error(err);
        res.status(500).json({
            message: "Server error"
        });
    }
}

export const login = async (req, res) => {

    try{
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({
                error: errors.array()
            })
        }

        const {
            username,
            password
        } = req.body;

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        if(
            !trimmedUsername ||
            !trimmedPassword
        ){
            return res.status(400).json({
                message: "All fields are required"
            })
        }

        const [rows] = await pool.query(
            "SELECT * FROM users WHERE username = ? LIMIT 1",
            [trimmedUsername]
        );

        if(rows.length === 0){
            return res.status(401).json({
                message: "Invalid Credentials"
            })
        }

        const user = rows[0];

        const isMatch = await bcrypt.compare(trimmedPassword, user.password_hash)

        if(!isMatch){
            return res.status(401).json({
                message: "Invalid Credentials"
            })
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await pool.query(
            "UPDATE users SET refresh_token = ? WHERE id = ?",
            [refreshToken, user.id]
        );

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            message: "Logged in successfully",
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        })

    }catch(err){
        console.error(err);
        res.status(500).json({
            message: "Server Error"
        })
    }
}

export const refresh = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if(!refreshToken){
        return res.status(401).json({
            message: "Refresh Token doesn't exists."
        })
    }

    try{
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        const [rows] = await pool.query(
            "SELECT * FROM users WHERE id = ? AND refresh_token = ?",
            [decoded.id, refreshToken]
        );

        if(rows.length === 0){
            return res.status(403).json({
                message: "Invalid or Revoked token"
            })
        }

        const user = rows[0];

        const newAccessToken = generateAccessToken(user);

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        })

        return res.status(200).json({
            message: "Token Refreshed"
        })
    }catch(err){
        console.log("Refresh Error:", err.name, err.message)
        return res.status(403).json({
            message: "Invalid or Expired Token"
        })
    }
}

export const logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if(refreshToken){
        await pool.query(
            "UPDATE users SET refresh_token = NULL WHERE refresh_token = ?",
            [refreshToken]
        )
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.status(200).json({
        message: "Logged out successfully"
    })
}