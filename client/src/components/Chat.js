import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Chat.css';

const Chat = ({ roomCode, userId, masterId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState({}); // Cache for usernames
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

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        setLoading(false);
        return;
      }

      console.log('Loaded messages:', data?.length || 0);

      if (data) {
        setMessages(data);
        
        // Fetch usernames for all unique user IDs
        const uniqueUserIds = [...new Set(data.map(m => m.user_id))];
        const usernamePromises = uniqueUserIds.map(async (uid) => {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username, email')
            .eq('id', uid)
            .maybeSingle();
          
          // Prioritize: username -> email prefix -> full email -> User ID
          let username = null;
          if (!profileError && profile) {
            username = profile.username || 
                      profile.email?.split('@')[0] || 
                      profile.email || 
                      null;
          }
          
          return {
            userId: uid,
            username: username || `User ${uid.substring(0, 8)}`
          };
        });

        const usernameData = await Promise.all(usernamePromises);
        const usernameMap = {};
        usernameData.forEach(({ userId, username }) => {
          usernameMap[userId] = username;
        });
        setUsernames(usernameMap);
      }

      setLoading(false);
    };

    loadMessages();

    // Polling fallback: check for new messages every 2 seconds if realtime fails
    // This ensures messages appear even if realtime isn't working
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(prev => {
          // Only update if there are new messages
          if (data.length > prev.length) {
            console.log('Polling found new messages:', data.length - prev.length);
            return data;
          }
          return prev;
        });
      }
    }, 2000); // Poll every 2 seconds

    return () => {
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
          broadcast: { self: true },
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
          console.log('Real-time message received:', payload);
          const newMessage = payload.new;
          
          // Check if message already exists (avoid duplicates)
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) {
              console.log('Message already exists, skipping:', newMessage.id);
              return prev;
            }
            console.log('Adding new message to state:', newMessage);
            return [...prev, newMessage];
          });
          
          // Fetch username if not cached
          setUsernames(prev => {
            if (prev[newMessage.user_id]) {
              return prev; // Already cached
            }
            
            // Fetch username asynchronously
            supabase
              .from('profiles')
              .select('username, email')
              .eq('id', newMessage.user_id)
              .maybeSingle()
              .then(({ data: profile, error: profileError }) => {
                // Prioritize: username -> email prefix -> full email -> User ID
                let username = null;
                if (!profileError && profile) {
                  username = profile.username || 
                            profile.email?.split('@')[0] || 
                            profile.email || 
                            null;
                }
                const displayName = username || `User ${newMessage.user_id.substring(0, 8)}`;
                setUsernames(current => ({ ...current, [newMessage.user_id]: displayName }));
              });
            
            return prev;
          });
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
      console.error('Full error object:', JSON.stringify(error, null, 2));
      alert(`Failed to send message: ${error.message}\n\nPlease check:\n1. Have you run the SQL script to create the messages table?\n2. Is Realtime enabled for the messages table?`);
      // Restore the message text so user can try again
      setNewMessage(messageText);
    } else {
      console.log('Message sent successfully:', data);
      // Message will appear via real-time subscription, but add it optimistically
      if (data) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === data.id);
          if (!exists) {
            return [...prev, data];
          }
          return prev;
        });
      }
      inputRef.current?.focus();
    }
  };

  const getUsername = (userId) => {
    return usernames[userId] || `User ${userId.substring(0, 8)}`;
  };

  const isMaster = (userId) => {
    return userId === masterId;
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

