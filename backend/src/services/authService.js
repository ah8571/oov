/**
 * Authentication service
 * Handles user registration, login, and JWT token generation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSupabaseClient, getSupabaseDebugInfo } from './databaseService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

const getSupabase = () => getSupabaseClient();

/**
 * Generate JWT token for a user
 */
export const generateToken = (userId, email) => {
  return jwt.sign(
    {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
};

/**
 * Register a new user
 */
export const registerUser = async (email, password, consentOptions = {}) => {
  const supabase = getSupabase();
  const supabaseDebug = getSupabaseDebugInfo();
  const {
    marketingOptIn = false,
    termsAccepted = false,
    privacyAccepted = false,
    termsVersion = null,
    privacyVersion = null,
    consentSource = 'mobile_signup',
    requiredConsentText = null,
    marketingConsentText = null,
    marketingPolicyVersion = null,
    consentUserAgent = 'unknown'
  } = consentOptions;

  // Validate input
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (!termsAccepted || !privacyAccepted) {
    throw new Error('Terms of Use and Privacy Policy acceptance are required');
  }

  // Check if user already exists
  let existingUser;
  let existingUserError;

  try {
    ({ data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle());
  } catch (error) {
    console.error('Supabase existing-user lookup threw before response', {
      message: error.message,
      cause: error.cause?.message || null,
      supabase: {
        configured: supabaseDebug.configured,
        host: supabaseDebug.host,
        normalizedRestSuffix: supabaseDebug.normalizedRestSuffix,
        normalizedUrl: supabaseDebug.normalizedUrl
      }
    });
    throw new Error(`Failed to check existing user: ${error.message} (supabase host: ${supabaseDebug.host})`);
  }

  if (existingUserError) {
    console.error('Supabase existing-user lookup returned an error response', {
      message: existingUserError.message,
      code: existingUserError.code || null,
      details: existingUserError.details || null,
      hint: existingUserError.hint || null,
      supabase: {
        configured: supabaseDebug.configured,
        host: supabaseDebug.host,
        normalizedRestSuffix: supabaseDebug.normalizedRestSuffix,
        normalizedUrl: supabaseDebug.normalizedUrl
      }
    });
    throw new Error(`Failed to check existing user: ${existingUserError.message}`);
  }

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user';
  const username = `${emailPrefix}_${Date.now().toString().slice(-6)}`;
  const nowIso = new Date().toISOString();

  // Create user in database
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      email,
      username,
      password_hash: passwordHash,
      marketing_opt_in: Boolean(marketingOptIn),
      created_at: nowIso,
      consent_source: consentSource,
      consent_user_agent: consentUserAgent,
      terms_accepted_at: nowIso,
      privacy_accepted_at: nowIso,
      terms_version: termsVersion,
      privacy_version: privacyVersion,
      terms_consent_text: requiredConsentText,
      privacy_consent_text: requiredConsentText,
      marketing_consent_at: marketingOptIn ? nowIso : null,
      marketing_policy_version: marketingPolicyVersion,
      marketing_consent_text: marketingOptIn ? marketingConsentText : null
    })
    .select()
    .single();

  if (error) {
    console.error('Error registering user:', error);
    throw new Error(`Failed to register user: ${error.message}`);
  }

  // Generate token
  const token = generateToken(newUser.id, newUser.email);

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      marketingOptIn: Boolean(newUser.marketing_opt_in),
      pricingTier: newUser.privacy_tier || 'tier1'
    },
    token
  };
};

/**
 * Login user
 */
export const loginUser = async (email, password) => {
  const supabase = getSupabase();

  // Validate input
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Find user
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (fetchError || !user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const token = generateToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      marketingOptIn: Boolean(user.marketing_opt_in),
      pricingTier: user.privacy_tier || 'tier1'
    },
    token
  };
};

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, created_at, marketing_opt_in, privacy_tier')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    marketingOptIn: Boolean(user.marketing_opt_in),
    pricingTier: user.privacy_tier || 'tier1'
  };
};

/**
 * Refresh token (returns new token)
 */
export const refreshToken = (decodedToken) => {
  return generateToken(decodedToken.userId, decodedToken.email);
};

export default {
  generateToken,
  verifyToken,
  registerUser,
  loginUser,
  getUserById,
  refreshToken
};
