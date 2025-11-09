// src/components/Chat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Chat.css';

/**
 * Chat component
 *
 * Props:
 *  - roomCode (string) - required
 *  - userId (string) - required (id of the current user, used when inserting messages)
 *  - masterId (string) - optional (for showing master badge)
 *  - paginatedOpportunities (array) - optional array of currently-visible/paginated opportunity objects (up to 5)
 *  - opportunitiesData (object) - optional full opportunities JSON data
 *
 * Notes:
 *  - This component calls the backend endpoint:
 *      POST {apiBase}/api/gemini/recommend-opportunity
 *    where apiBase is taken from REACT_APP_API_URL env var or defaults to '' (same origin).
 *  - The body contains { room_code, displayed_opportunities } (displayed_opportunities is an array of {id,name,link,country})
 *  - On success the endpoint must return JSON with at least { recommendation: string, analyzed_count: number }.
 *  - The recommendation text is inserted into the 'messages' table via Supabase after being returned.
 */

const Chat = ({ roomCode, userId, masterId, paginatedOpportunities = [], opportunitiesData = null }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState({}); // Cache for usernames
  const [askWorldAILoading, setAskWorldAILoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages and set up polling as fallback
  useEffect(() => {
    if (!roomCode) return;

    let stopped = false;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_code', roomCode)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading messages:', error);
          setLoading(false);
          return;
        }

        if (stopped) return;

        console.log('Loaded messages:', data?.length || 0);

        if (data) {
          setMessages(data);

          // Fetch usernames for all unique user IDs (cache them)
          const uniqueUserIds = [...new Set(data.map((m) => m.user_id))];
          const usernamePromises = uniqueUserIds.map(async (uid) => {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('username, email')
                .eq('id', uid)
                .maybeSingle();

              let username = null;
              if (!profileError && profile) {
                username =
                  profile.username ||
                  (profile.email ? profile.email.split('@')[0] : null) ||
                  profile.email ||
                  null;
              }

              return {
                userId: uid,
                username: username || `User ${uid?.substring ? uid.substring(0, 8) : uid}`,
              };
            } catch (err) {
              // in case profile lookup fails, still return fallback
              return { userId: uid, username: `User ${uid?.substring ? uid.substring(0, 8) : uid}` };
            }
          });

          const usernameData = await Promise.all(usernamePromises);
          const usernameMap = {};
          usernameData.forEach(({ userId, username }) => {
            usernameMap[userId] = username;
          });
          setUsernames(usernameMap);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error in loadMessages:', err);
        setLoading(false);
      }
    };

    loadMessages();

    // Polling fallback: check for new messages every 2 seconds if realtime fails
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('room_code', roomCode)
          .order('created_at', { ascending: true });

        if (data) {
          setMessages((prev) => {
            if (data.length > prev.length) {
              console.log('Polling found new messages:', data.length - prev.length);
              return data;
            }
            return prev;
          });
        }
      } catch (err) {
        // ignore polling errors but log
        console.debug('Polling error fetching messages:', err);
      }
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(pollInterval);
    };
  }, [roomCode]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!roomCode) return;

    console.log('Setting up real-time subscription for messages in room:', roomCode);

    const channel = supabase
      .channel(`messages-${roomCode}`, {
        config: {
          broadcast: { self: true }, // include self events for optimistic UI if you want
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          try {
            console.log('Real-time message received:', payload);
            const newMsg = payload.new;
            // avoid duplicate
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMsg.id);
              if (exists) {
                return prev;
              }
              return [...prev, newMsg];
            });

            // fetch username if not cached
            setUsernames((prev) => {
              if (prev[newMsg.user_id]) return prev;
              // async fetch
              supabase
                .from('profiles')
                .select('username, email')
                .eq('id', newMsg.user_id)
                .maybeSingle()
                .then(({ data: profile, error: profileError }) => {
                  let username = null;
                  if (!profileError && profile) {
                    username =
                      profile.username ||
                      (profile.email ? profile.email.split('@')[0] : null) ||
                      profile.email ||
                      null;
                  }
                  const displayName = username || `User ${newMsg.user_id?.substring ? newMsg.user_id.substring(0, 8) : newMsg.user_id}`;
                  setUsernames((current) => ({ ...current, [newMsg.user_id]: displayName }));
                })
                .catch((e) => {
                  console.debug('Failed fetching profile for realtime message:', e);
                });

              return prev;
            });
          } catch (e) {
            console.error('Error handling realtime message payload', e);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Messages subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error:', err);
          console.error('Make sure Realtime is enabled for the messages table in Supabase Dashboard');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Subscription timed out');
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Subscription closed');
        }
      });

    return () => {
      console.log('Cleaning up messages subscription');
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !roomCode || !userId) {
      console.log('Cannot send message - missing data:', { newMessage: newMessage.trim(), roomCode, userId });
      return;
    }

    const messageText = newMessage.trim();
    console.log('Sending message:', { roomCode, userId, message: messageText });

    // Clear input immediately for better UX
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          room_code: roomCode,
          user_id: userId,
          message: messageText,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        alert(
          `Failed to send message: ${error.message}\n\nPlease check:\n1. Have you run the SQL script to create the messages table?\n2. Is Realtime enabled for the messages table?`
        );
        // Restore the message text so user can try again
        setNewMessage(messageText);
      } else {
        console.log('Message sent successfully:', data);
        // Message will appear via real-time subscription; also add it optimistically if missing
        if (data) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === data.id);
            if (!exists) {
              return [...prev, data];
            }
            return prev;
          });
        }
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Unexpected error sending message:', err);
      setNewMessage(messageText);
    }
  };

  const getUsername = (uid) => {
    return usernames[uid] || `User ${uid?.substring ? uid.substring(0, 8) : uid}`;
  };

  const isMaster = (uid) => {
    return uid === masterId;
  };

  // Ask WorldAI: calls backend endpoint and inserts returned recommendation as a message
  const handleAskWorldAI = async () => {
    if (!paginatedOpportunities || paginatedOpportunities.length === 0) {
      alert('No opportunities available to analyze. Please wait for opportunities to load.');
      return;
    }

    setAskWorldAILoading(true);

    try {
      // Send only the currently displayed (paginated) opportunities (up to 5) to the backend
      const displayedOpportunities = paginatedOpportunities.map(opp => ({
        id: opp.id || null,
        name: opp.name || '',
        link: opp.link || '',
        country: opp.country || '',
      }));

      const payload = {
        room_code: roomCode,
        displayed_opportunities: displayedOpportunities,
      };

      console.log('Calling recommend-opportunity with paginated opportunities:', displayedOpportunities);

      // apiBase: allow same-origin by default. If your backend runs on a different origin, set REACT_APP_API_URL.
      const apiBase = process.env.REACT_APP_API_URL ?? '';
      const endpoint = `${apiBase}/api/gemini/recommend-opportunity`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('Recommend endpoint returned non-OK status', response.status, text);
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch (err) {
          parsed = null;
        }
        const humanMessage = parsed?.detail ? JSON.stringify(parsed.detail, null, 2) : text || `HTTP ${response.status}`;
        alert(`Failed to get recommendation (status ${response.status}):\n\n${humanMessage}`);
        setAskWorldAILoading(false);
        return;
      }

      const data = await response.json().catch(() => null);

      const recommendationText = data?.recommendation || data?.result || JSON.stringify(data) || 'No recommendation received.';
      const recommendationMessage = `🤖 WorldAI Recommendation:\n\n${recommendationText}`;

      // Insert recommendation into messages table (so it appears in chat)
      // We insert with current userId (you might want to use a dedicated system userId instead)
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          room_code: roomCode,
          user_id: userId,
          message: recommendationMessage,
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error sending recommendation message:', messageError);
        // show recommendation to user even if DB insert failed
        alert(`WorldAI Recommendation:\n\n${recommendationText}`);
      } else {
        console.log('Recommendation message inserted:', messageData);
      }
    } catch (error) {
      console.error('Error calling WorldAI:', error);
      const msg = error?.message || String(error);
      alert(`Failed to get recommendation from WorldAI: ${msg}`);
    } finally {
      setAskWorldAILoading(false);
    }
  };

  if (loading) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h3>Chat</h3>
        </div>
        <div className="chat-loading">
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat</h3>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <div className="message-header">
                <span className="message-username">
                  {isMaster(msg.user_id) && <span className="master-emoji">👑</span>}
                  {getUsername(msg.user_id)}
                </span>
                <span className="message-time">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="message-text">{msg.message}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <button
        className="ask-worldai-btn"
        onClick={handleAskWorldAI}
        disabled={askWorldAILoading || !paginatedOpportunities || paginatedOpportunities.length === 0}
      >
        {askWorldAILoading ? (
          <span className="ask-worldai-loading">
            <span>⏳</span>
            <span>Analyzing opportunities...</span>
          </span>
        ) : (
          'Ask WorldAI'
        )}
      </button>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit" className="chat-send-btn" disabled={!newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
