const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    try {
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: 'Access Denied: No Token' });
        }

        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = verified;
        
        next(); 
    } catch (err) {
        res.status(400).json({ message: 'Invalid Token' });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Access Forbidden: Requires one of these roles: ${allowedRoles.join(', ')}` 
            });
        }
        next();
    };
};

module.exports = { authenticateUser, authorizeRoles };