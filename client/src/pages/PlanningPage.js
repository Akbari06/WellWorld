import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import GlobeComponent from '../components/globe';
import Chat from '../components/Chat';
import OpportunitiesPanel from '../components/OpportunitiesPanel';
import './PlanningPage.css';

const PlanningPage = ({ user }) => {
  const { code } = useParams();
  const navigate = useNavigate();
  const roomCode = (code || '').toString().toUpperCase();
  const [loading, setLoading] = useState(true);
  const [roomExists, setRoomExists] = useState(false);
  const [error, setError] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [masterId, setMasterId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [opportunityMarker, setOpportunityMarker] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [opportunities, setOpportunities] = useState([]);

  useEffect(() => {
    (async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      // Verify room exists and planning has started
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('planning_started, master_id, selected_opportunity_lat, selected_opportunity_lng')
        .eq('room_code', roomCode)
        .single();

      if (roomError || !room) {
        setError('Room not found or has been deleted.');
        setLoading(false);
        return;
      }

      if (!room.planning_started) {
        // Planning hasn't started yet, redirect to room page
        navigate(`/room/${roomCode}`);
        return;
      }

      // Check if user is master
      const userIsMaster = room.master_id === user.id;
      setIsMaster(userIsMaster);
      setMasterId(room.master_id);
      setUserId(user.id);

      // Load initial opportunity marker if one exists
      if (room.selected_opportunity_lat && room.selected_opportunity_lng) {
        setOpportunityMarker({
          lat: room.selected_opportunity_lat,
          lng: room.selected_opportunity_lng,
          name: null // Will be set by OpportunitiesPanel when it loads
        });
      }
      
      // Load initial selected country if one exists
      if (room.selected_country) {
        setSelectedCountry(room.selected_country);
      }

      // Verify user is a participant
      const { data: participant } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_code', roomCode)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!participant) {
        // User is not a participant, add them
        await supabase
          .from('room_participants')
          .insert({
            room_code: roomCode,
            user_id: user.id,
            is_master: userIsMaster,
          });
      }

      setRoomExists(true);
      setLoading(false);
    })();
  }, [user, roomCode, navigate]);

  // Real-time subscription for room deletion and opportunity updates
  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase
      .channel(`planning-room-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rooms', filter: `room_code=eq.${roomCode}` },
        () => {
          // Room was deleted, redirect all users to landing page
          alert('Room has been deleted.');
          navigate('/');
        }
      )
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'rooms',
                  filter: `room_code=eq.${roomCode}`,
                },
                (payload) => {
                  const { selected_opportunity_lat, selected_opportunity_lng, selected_country } = payload.new || {};
                  const oldLat = payload.old?.selected_opportunity_lat;
                  const oldLng = payload.old?.selected_opportunity_lng;
                  const oldSelectedCountry = payload.old?.selected_country;
                  
                  // Handle country selection changes
                  if (selected_country !== oldSelectedCountry) {
                    setSelectedCountry(selected_country);
                    // Clear opportunity marker when country is selected
                    if (selected_country) {
                      setOpportunityMarker(null);
                    }
                  }
                  
                  // Handle opportunity marker updates (only if no country is selected)
                  if (selected_opportunity_lat !== oldLat || selected_opportunity_lng !== oldLng) {
                    // Only update opportunity marker if no country is currently selected
                    if (!selected_country) {
                      if (selected_opportunity_lat && selected_opportunity_lng) {
                        setOpportunityMarker({
                          lat: selected_opportunity_lat,
                          lng: selected_opportunity_lng,
                          name: null // Name will be set by OpportunitiesPanel
                        });
                      } else {
                        setOpportunityMarker(null);
                      }
                    } else {
                      // Country is selected, clear opportunity marker
                      setOpportunityMarker(null);
                    }
                  }
                }
              )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, navigate]);

  const handleLeaveRoom = async () => {
    if (!user) return;

    if (isMaster) {
      // Master user: Delete the room (this will trigger real-time updates for all users)
      if (!window.confirm('Are you sure you want to leave and delete this room? All participants will be returned to the landing page.')) {
        return;
      }

      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('room_code', roomCode)
        .eq('master_id', userId);

      if (error) {
        alert('Failed to delete room.');
        console.error('Error deleting room:', error);
      } else {
        // Room deleted successfully, navigate to landing page
        navigate('/');
      }
    } else {
      // Non-master user: Remove from participants and navigate to landing page
      const { error } = await supabase
        .from('room_participants')
        .delete()
        .eq('room_code', roomCode)
        .eq('user_id', userId);

      if (error) {
        alert('Failed to leave room.');
        console.error('Error leaving room:', error);
      } else {
        // Successfully left room, navigate to landing page
        navigate('/');
      }
    }
  };

  if (loading) {
    return (
      <div className="planning-page">
        <div className="planning-loading">
          <p>Loading planning session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="planning-page">
        <div className="planning-error">
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomExists) {
    return null;
  }

  return (
    <div className="planning-page">
      <div className="planning-header">
        <h1>Planning Room: {roomCode}</h1>
        <button 
          onClick={handleLeaveRoom} 
          className="btn btn-leave-room"
        >
          Leave Room
        </button>
      </div>
      <div className="planning-content">
        {/* Globe as background layer - centered */}
        <div className="globe-wrapper">
          <GlobeComponent 
            roomCode={roomCode} 
            isMaster={isMaster} 
            user={user} 
            opportunityMarker={opportunityMarker}
            opportunities={opportunities}
            onCountrySelect={(country) => {
              console.log('PlanningPage: Country selected:', country);
              setSelectedCountry(country);
              // Clear opportunity marker when country is selected
              setOpportunityMarker(null);
              // Clear opportunity marker from database
              if (roomCode) {
                supabase
                  .from('rooms')
                  .update({
                    selected_opportunity_lat: null,
                    selected_opportunity_lng: null,
                  })
                  .eq('room_code', roomCode);
              }
            }}
          />
        </div>
        {/* Chat and Opportunities as overlays */}
        <Chat roomCode={roomCode} userId={user?.id} masterId={masterId} />
        <OpportunitiesPanel 
          roomCode={roomCode} 
          selectedCountry={selectedCountry}
          onOpportunitySelect={(lat, lng, name) => {
            console.log('PlanningPage: onOpportunitySelect called with:', { lat, lng, name });
            if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
              setOpportunityMarker({ lat, lng, name });
              // Clear country selection when a specific opportunity is selected
              setSelectedCountry(null);
              console.log('PlanningPage: Set opportunityMarker to:', { lat, lng, name });
            } else {
              setOpportunityMarker(null);
              console.log('PlanningPage: Cleared opportunityMarker');
            }
          }}
          onCountrySelect={(country) => {
            console.log('PlanningPage: Country selected from opportunity:', country);
            setSelectedCountry(country);
            // Clear opportunity marker when country is selected
            setOpportunityMarker(null);
            // Clear opportunity marker from database
            if (roomCode) {
              supabase
                .from('rooms')
                .update({
                  selected_opportunity_lat: null,
                  selected_opportunity_lng: null,
                })
                .eq('room_code', roomCode);
            }
          }}
          onOpportunitiesChange={(opps) => {
            setOpportunities(opps);
          }}
        />
      </div>
    </div>
  );
};

export default PlanningPage;

