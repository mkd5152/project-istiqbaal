import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import CrestPng from '../assets/tkmLogo.png';

function LoginPage({ onLogin, setRole }) {
  const [its, setITS] = useState('');

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    try {
      console.log('Attempting to login with ITS:', its);
      console.log('ITS type:', typeof its);
      console.log('ITS as string:', its.toString());
      
      // First try without .single() to see what we get
      const { data: allUsers, error: listError } = await supabase
        .from('users')
        .select('*');
      
      console.log('All users in database:', allUsers);
      console.log('List error:', listError);
      
      // Try a different approach - check if RLS is the issue
      const { data: testQuery, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      console.log('Test query result:', testQuery);
      console.log('Test query error:', testError);
      
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('its_number', its.toString())
        .single();

      console.log('User lookup result:', { users, error });
      
      if (error) {
        console.error('User lookup error:', error);
        alert('ITS number not registered');
        return;
      }

      if (users) {
        // Try to sign in first
        let { data, error: authError } = await supabase.auth.signInWithPassword({
          email: `${its}@its-login.com`,
          password: its,
        });
        
        // If auth user doesn't exist, create it
        if (authError && authError.message.includes('Invalid login credentials')) {
          console.log('Auth user not found, creating new auth user...');
          console.log('Attempting to create auth user for:', `${its}@its-login.com`);
          
          // Try to create auth user with email confirmation disabled
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: `${its}@its-login.com`,
            password: its,
            options: {
              data: {
                its_number: its
              },
              emailRedirectTo: window.location.origin
            }
          });
          
          console.log('SignUp result:', signUpData);
          console.log('SignUp error:', signUpError);
          
          if (signUpError) {
            console.error('SignUp error:', signUpError);
            if (signUpError.message.includes('email') || signUpError.message.includes('confirmation')) {
              alert('Please disable email confirmations in Supabase Auth settings, or contact admin.');
              return;
            }
            alert('Login failed: Could not create auth user - ' + signUpError.message);
            return;
          }
          
          if (signUpData.user && !signUpData.session) {
            alert('User created but email confirmation required. Please check Supabase Auth settings.');
            return;
          }
          
          // Try to sign in again with the newly created user
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: `${its}@its-login.com`,
            password: its,
          });
          
          if (signInError) {
            console.error('SignIn error after creation:', signInError);
            alert('Login failed');
            return;
          }
          
          data = signInData;
          authError = signInError;
        }
        
        if (!authError) {
          onLogin(data.user);
          setRole(users.role);
        } else {
          console.error('Auth error:', authError);
          alert('Login failed');
        }
      } else {
        alert('ITS number not registered');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('ITS number not registered');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5DC',
      color: '#1C1C1C'
    }}>
      <form onSubmit={handleLogin} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        width: 'min(90vw, 520px)'
      }}>
        <img src={CrestPng} alt="Logo" style={{ width: 140, height: 'auto' }} />
        <h1 style={{
          margin: 0,
          fontWeight: 700,
          fontSize: 40,
          textAlign: 'center'
        }}>Login with ITS</h1>

        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter ITS ID"
          maxLength={8}
          value={its}
          onChange={(e) => setITS(e.target.value.replace(/\D/g, ''))}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 12,
            border: 'none',
            outline: 'none',
            backgroundColor: '#A9DFBF',
            color: '#1C1C1C',
            padding: '0 20px',
            fontSize: 18,
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}
        />

        <button
          type="submit"
          disabled={!its}
          style={{
            width: '60%',
            height: 58,
            borderRadius: 29,
            border: 'none',
            cursor: its ? 'pointer' : 'not-allowed',
            backgroundColor: '#006400',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: 0.4
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default LoginPage;