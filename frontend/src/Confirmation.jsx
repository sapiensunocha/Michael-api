import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './Confirmation.css';

// Placeholder for the backend API call to confirm the user's email.
// In a real application, you would replace this with a call to your
// backend, passing the confirmation token from the URL.
// This function would typically return a success or error message.
const confirmUserEmail = async (token) => {
  // Simulate an API call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (token) {
        // Here you would make an actual API call, e.g., using axios or fetch:
        // const response = await fetch(`/api/confirm-email?token=${token}`);
        // if (response.ok) {
        //   resolve({ success: true, message: 'Your email has been successfully confirmed!' });
        // } else {
        //   reject(new Error('Invalid or expired confirmation token.'));
        // }
        
        // For demonstration, we'll assume a valid token resolves successfully.
        resolve({ success: true, message: 'Your email has been successfully confirmed!' });
      } else {
        reject(new Error('No confirmation token found.'));
      }
    }, 1500); // Simulate a network delay
  });
};

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
        const result = await confirmUserEmail(token);
        if (result.success) {
          setStatus('success');
          setMessage(result.message);
        } else {
          setStatus('error');
          setMessage('Email confirmation failed. Please try again.');
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
