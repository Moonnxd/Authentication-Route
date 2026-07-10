import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) =>  {
    const token = req.cookies.accessToken;

    if(!token){
        return res.status(401).json({
            message: "Not authenticated"
        })
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if(err){
            return res.status(401).json({
                message: "Invalid/Expired Token"
            })
        }
        
        req.user = decode;
        next();
    })
}