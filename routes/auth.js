const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// REGISTRO
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Faltan datos' });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: 'El email ya está registrado' });

    // Crear usuario
    const newUser = new User({ name, email, password });
    await newUser.save();

    // ✅ Generar token JWT
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // ✅ Enviar cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // en prod se usa https
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000, // 1 día
    });

    res.json({
      message: 'Usuario registrado y logueado correctamente',
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ error: 'Contraseña incorrecta' });

    // ✅ Generar token JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // ✅ Guardar token en cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // usar HTTPS en producción
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000, // 1 día
    });

    // ✅ Devolver usuario para el frontend
    res.json({
      message: 'Login correcto',
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // usar HTTPS en producción
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000, // 1 día
  });
  res.json({ message: 'Sesión cerrada' });
});

// VERIFICAR SESIÓN
router.get('/verify', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ loggedIn: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) return res.status(401).json({ loggedIn: false });

    res.json({ loggedIn: true, user });
  } catch {
    res.status(401).json({ loggedIn: false });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ user: null });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) return res.status(401).json({ user: null });

    res.json({ user });
  } catch {
    res.status(401).json({ user: null });
  }
});

module.exports = router;
