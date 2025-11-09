import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './JoinRoomPage.css';

const JoinRoomPage = ({ user }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    
    if (!roomCode || roomCode.length !== 6) {
      setError('Please enter a valid 6-digit room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!user) {
        setError('Please sign in to join a room.');
        setLoading(false);
        return;
      }

      const currentUser = user;

      // Check if room exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .single();

      if (roomError || !room) {
        setError('Room not found or has been deleted. Please check the code and try again.');
        setLoading(false);
        return;
      }

      // If planning has already started, redirect to planning page immediately
      if (room.planning_started) {
        // Still add user to room if not already in it
        const { data: existing } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_code', roomCode.toUpperCase())
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from('room_participants')
            .insert({
              room_code: roomCode.toUpperCase(),
              user_id: currentUser.id,
              is_master: false,
            });
        }

        navigate(`/planning/${roomCode.toUpperCase()}`);
        return;
      }

      // Check current participant count
      const { count: participantCount } = await supabase
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_code', roomCode.toUpperCase());

      // Check if room is full (max 4 people)
      if (participantCount >= 4) {
        setError('Room is full. Maximum 4 people allowed per room.');
        setLoading(false);
        return;
      }

      // Check if user is already in the room
      const { data: existing, error: checkError } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .eq('user_id', currentUser.id)
        .maybeSingle();

      // Only insert if user is not already in the room and no error occurred
      if (!existing && !checkError) {
        // Add user to room
        const { error: joinError } = await supabase
          .from('room_participants')
          .insert({
            room_code: roomCode.toUpperCase(),
            user_id: currentUser.id,
            is_master: false,
          });

        // 409 Conflict means user is already in room, which is fine
        if (joinError && joinError.code !== '23505') {
          throw joinError;
        }
      }

      // Redirect to room page
      navigate(`/room/${roomCode.toUpperCase()}`);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="join-room-page">
      <div className="join-room-container">
        <div className="join-room-logo">
          <img className="join-room-logo-mark" src="/favicon.ico" alt="WellWorld Logo" />
          <div className="join-room-logo-text">
            <h1 className="page-title">Join Room</h1>
            <p className="join-room-tagline">Enter Room Code</p>
          </div>
        </div>
        <p className="page-subtitle">
          Enter the 6-digit room code to join
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleJoin} className="join-form">
          <input
            type="text"
            className="room-code-input"
            value={roomCode}
            onChange={(e) => {
              const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
              setRoomCode(value);
              setError('');
            }}
            placeholder="ROOM CODE"
            maxLength={6}
            autoFocus
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || roomCode.length !== 6}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </form>

        <button
          type="button"
          className="btn-link"
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default JoinRoomPage;

