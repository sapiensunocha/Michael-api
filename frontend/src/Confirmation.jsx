// frontend/src/Confirmation.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmUser } from './api/backendApi'; // <-- backend API
import './Confirmation.css';

function Confirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No confirmation token was found in the URL.');
      return;
    }

    const verifyToken = async () => {
      try {
        // Call backend API to confirm user
        const response = await confirmUser(token);

        if (response.success) {
          setStatus('success');
          setMessage(
            'Your email is now a key to a world that watches, learns, and protects. ' +
            'You are part of Michael — our global guardian scanning skies, rivers, and cities, alerting when danger whispers. ' +
            'From this moment, your journey begins: a journey of foresight, resilience, and hope. ' +
            'Thank you for joining the World Disaster Center.'
          );
        } else {
          setStatus('error');
          setMessage(response.message || 'Email not confirmed yet. Please try again or request a new confirmation link.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'An error occurred during confirmation.');
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <div className="confirmation-container">
      <div className="confirmation-card">
        <img src="/logo512.png" alt="WDC Logo" className="wdc-logo" />
        <h2>Email Confirmation</h2>
        <div className="confirmation-message">
          {status === 'loading' && (
            <p className="message loading">
              Verifying your email... Please wait.
            </p>
          )}
          {status === 'success' && (
            <p className="message success">
              {message}
              <br />
              <button onClick={() => navigate('/login')} className="redirect-button">
                Continue to Login
              </button>
            </p>
          )}
          {status === 'error' && (
            <p className="message error">
              {message}
              <br />
              <span onClick={() => navigate('/register')} className="redirect-link">
                Go back to registration
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Confirmation;