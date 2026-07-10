import jwt from 'jsonwebtoken';

export const generateAccessToken = (user) => {
    return jwt.sign(
        {id: user.id, username: user.username, role: user.role},
        process.env.ACCESS_TOKEN_SECRET,
        {expiresIn: '15min'}
    );
};

export const generateRefreshToken = (user) => {
    return jwt.sign(
        {id: user.id},
        process.env.REFRESH_TOKEN_SECRET,
        {expiresIn: '7d'}
    );
};