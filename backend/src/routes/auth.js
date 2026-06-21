/**
 * Routes for authentication
 * Handles user registration, login, and token refresh
 */

import express from 'express';
import { registerUser, loginUser, getUserById, refreshToken } from '../services/authService.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      marketingOptIn = false,
      termsAccepted = false,
      privacyAccepted = false,
      termsVersion,
      privacyVersion,
      consentSource = 'mobile_signup',
      requiredConsentText,
      marketingConsentText,
      marketingPolicyVersion
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!termsAccepted || !privacyAccepted) {
      return res.status(400).json({ error: 'You must accept the Terms of Use and Privacy Policy to create an account' });
    }

    const result = await registerUser(email, password, {
      marketingOptIn,
      termsAccepted,
      privacyAccepted,
      termsVersion,
      privacyVersion,
      consentSource,
      requiredConsentText,
      marketingConsentText,
      marketingPolicyVersion,
      consentUserAgent: req.get('user-agent') || 'unknown'
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Registration error:', error.message);

    if (error.message.includes('already registered')) {
      return res.status(409).json({ error: error.message });
    }

    if (error.message.includes('at least 8 characters')) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message.includes('Failed to register user') || error.message.includes('Failed to check existing user')) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await loginUser(email, password);

    return res.status(200).json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Login error:', error.message);

    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const newToken = refreshToken(req.user);

    return res.status(200).json({
      message: 'Token refreshed',
      token: newToken
    });
  } catch (error) {
    console.error('Token refresh error:', error.message);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);

    return res.status(200).json({
      user
    });
  } catch (error) {
    console.error('Get user error:', error.message);
    return res.status(404).json({ error: 'User not found' });
  }
});

export default router;
