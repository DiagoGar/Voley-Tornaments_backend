const jwt = require("jsonwebtoken");
const User = require("../models/User.js");

const authMiddleware = async (req, res, next) => {
 try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: "No autorizado. Falta token." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    req.user = user; // <- Aquí lo seteamos
    next();
  } catch (error) {
    console.error("Error en authMiddleware:", error);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

module.exports = authMiddleware