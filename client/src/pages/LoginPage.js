import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        // Sign up
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Successfully signed up, user will be redirected automatically
          navigate('/');
        }
      } else {
        // Sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // Check if it's an invalid login (user doesn't exist)
          if (signInError.message.includes('Invalid login credentials') || signInError.message.includes('Email not confirmed')) {
            setError('You need to sign up. Please use the "Sign Up" option below.');
          } else {
            throw signInError;
          }
          return;
        }

        if (data.user) {
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <img className="login-logo-mark" src="/favicon.ico" alt="WellWorld Logo" />
          <div className="login-logo-text">
            <h1 className="login-title">WellWorld</h1>
            <p className="login-tagline">Wellbeing through Social Good</p>
          </div>
        </div>
        <p className="login-subtitle">
          {isSignUp ? 'Create an account' : 'Sign in to your account'}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && (
            <input
              type="text"
              className="form-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required={isSignUp}
            />
          )}

          <input
            type="email"
            className="form-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <input
            type="password"
            className="form-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={6}
          />

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? 'Please wait...'
              : isSignUp
              ? 'Sign Up'
              : 'Sign In'}
          </button>
        </form>

        <div className="login-switch">
          <p>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
