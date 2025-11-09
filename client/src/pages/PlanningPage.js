import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import GlobeComponent from '../components/globe';
import Chat from '../components/Chat';
import OpportunitiesPanel from '../components/OpportunitiesPanel';
import DinosaurGame from '../components/DinosaurGame';
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
  const [paginatedOpportunities, setPaginatedOpportunities] = useState([]);
  const [opportunitiesData, setOpportunitiesData] = useState(null);
  const [catsActive, setCatsActive] = useState(false);
  const [cats, setCats] = useState([]);
  const catIntervalRef = useRef(null);
  const catContainerRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [previousMousePosition, setPreviousMousePosition] = useState({ x: 0, y: 0 });
  const waftRadius = 150; // Increased radius in pixels for wafting away cats
  const waftPower = 3.5; // Multiplier for push strength
  const [explosionActive, setExplosionActive] = useState(false);
  const explosionGifRef = useRef(null);
  const explosionTimeoutRef = useRef(null);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const hideButtonsTimeoutRef = useRef(null);
  const [globeImageUrl, setGlobeImageUrl] = useState(null);
  const globeImageTimeoutRef = useRef(null);
  const [masterIdle, setMasterIdle] = useState(false);
  const masterIdleTimeoutRef = useRef(null);
  const lastMasterActionRef = useRef(Date.now());
  const [showDinosaurGame, setShowDinosaurGame] = useState(false);

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
        // If master has already selected something, they're not idle
        if (userIsMaster) {
          lastMasterActionRef.current = Date.now();
        }
      }
      
      // If master has selected an opportunity, they're not idle
      if (room.selected_opportunity_lat && room.selected_opportunity_lng && userIsMaster) {
        lastMasterActionRef.current = Date.now();
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
                  
                  // Detect master activity (country or opportunity selection) - stops idle game
                  if (selected_country !== oldSelectedCountry || 
                      selected_opportunity_lat !== oldLat || 
                      selected_opportunity_lng !== oldLng) {
                    // Master made a selection, stop idle game
                    setMasterIdle(false);
                    setShowDinosaurGame(false); // Hide game when master becomes active
                    if (masterIdleTimeoutRef.current) {
                      clearTimeout(masterIdleTimeoutRef.current);
                      masterIdleTimeoutRef.current = null;
                    }
                    // Reset idle timer
                    lastMasterActionRef.current = Date.now();
                    masterIdleTimeoutRef.current = setTimeout(() => {
                      if (!isMaster) {
                        setMasterIdle(true);
                      }
                    }, 5000);
                  }
                  
                  // Handle country selection changes
                  if (selected_country !== oldSelectedCountry) {
                    setSelectedCountry(selected_country);
                    // Clear opportunity marker only if country is being set (not when cleared)
                    if (selected_country) {
                      setOpportunityMarker(null);
                    }
                    // If country is cleared but opportunity is set, keep the opportunity marker
                  }
                  
                  // Handle opportunity marker updates
                  if (selected_opportunity_lat !== oldLat || selected_opportunity_lng !== oldLng) {
                    // Only update if no country is currently selected
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

    // Initialize master idle detection - start timer after 5 seconds
    // Only if master hasn't already selected something
    const hasSelection = selectedCountry || (opportunityMarker && opportunityMarker.lat);
    if (!hasSelection) {
      lastMasterActionRef.current = Date.now();
      masterIdleTimeoutRef.current = setTimeout(() => {
        if (!isMaster) {
          setMasterIdle(true);
        }
      }, 5000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (masterIdleTimeoutRef.current) {
        clearTimeout(masterIdleTimeoutRef.current);
      }
    };
  }, [roomCode, navigate, isMaster, selectedCountry, opportunityMarker]);

  // Cat invasion functionality
  const startCatInvasion = () => {
    setCatsActive(true);
    setCats([]);
    
    // Generate cats slowly to fill the screen
    const catImages = ['/cat.png', '/cat2.png'];
    const baseCatSize = 80; // Base size of each cat image
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const catsPerRow = Math.ceil(screenWidth / baseCatSize) + 2; // Add extra for overlap
    const catsPerCol = Math.ceil(screenHeight / baseCatSize) + 2;
    const totalCats = catsPerRow * catsPerCol;
    
    let catCount = 0;
    
    catIntervalRef.current = setInterval(() => {
      if (catCount >= totalCats) {
        clearInterval(catIntervalRef.current);
        return;
      }
      
      // Generate a new cat with random positioning and random size
      const row = Math.floor(catCount / catsPerRow);
      const col = catCount % catsPerRow;
      const x = col * baseCatSize + (Math.random() * 30 - 15);
      const y = row * baseCatSize + (Math.random() * 30 - 15);
      const rotation = Math.random() * 360;
      const image = catImages[Math.floor(Math.random() * catImages.length)];
      
      // Random size from 0.5x to 4x the base size
      const sizeMultiplier = 0.5 + Math.random() * 3.5; // Range: 0.5 to 4.0
      const catSize = baseCatSize * sizeMultiplier;
      
      setCats(prev => [...prev, {
        id: catCount,
        x,
        y,
        rotation,
        image,
        size: catSize
      }]);
      
      catCount++;
    }, 30); // Add a new cat every 30ms for faster filling
  };

  const stopCatInvasion = () => {
    setCatsActive(false);
    setCats([]);
    setIsMouseDown(false);
    if (catIntervalRef.current) {
      clearInterval(catIntervalRef.current);
      catIntervalRef.current = null;
    }
  };

  // Mouse handlers for wafting cats away
  const handleMouseDown = (e) => {
    if (catsActive) {
      setIsMouseDown(true);
      const pos = { x: e.clientX, y: e.clientY };
      setMousePosition(pos);
      setPreviousMousePosition(pos);
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e) => {
    if (catsActive && isMouseDown) {
      const newPosition = { x: e.clientX, y: e.clientY };
      
      // Calculate mouse movement velocity for more powerful wafting
      const deltaX = newPosition.x - previousMousePosition.x;
      const deltaY = newPosition.y - previousMousePosition.y;
      const mouseVelocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      setMousePosition(newPosition);
      setPreviousMousePosition(newPosition);
      
      // Push cats away from cursor when within waft radius with much more power
      setCats(prev => prev.map(cat => {
        const catCenterX = cat.x + (cat.size / 2);
        const catCenterY = cat.y + (cat.size / 2);
        const distance = Math.sqrt(
          Math.pow(catCenterX - newPosition.x, 2) + 
          Math.pow(catCenterY - newPosition.y, 2)
        );
        
        // If cat is within waft radius, push it away with much more force
        if (distance < waftRadius) {
          const angle = Math.atan2(catCenterY - newPosition.y, catCenterX - newPosition.x);
          
          // Calculate push distance based on:
          // 1. Distance from cursor (closer = stronger push)
          // 2. Mouse velocity (faster movement = stronger push)
          // 3. Power multiplier
          const distanceFactor = (waftRadius - distance) / waftRadius; // 0 to 1, closer = higher
          const velocityFactor = Math.min(mouseVelocity / 10, 2); // Cap at 2x for very fast movement
          const basePush = (waftRadius - distance) * waftPower;
          const pushDistance = basePush * (1 + distanceFactor) * (1 + velocityFactor * 0.5);
          
          const newX = cat.x + Math.cos(angle) * pushDistance;
          const newY = cat.y + Math.sin(angle) * pushDistance;
          
          return {
            ...cat,
            x: newX,
            y: newY
          };
        }
        
        return cat;
      }));
    } else if (catsActive) {
      const pos = { x: e.clientX, y: e.clientY };
      setMousePosition(pos);
      setPreviousMousePosition(pos);
    }
  };

  // Remove cats that have left the screen
  useEffect(() => {
    if (!catsActive || cats.length === 0) return;

    const checkCatsBounds = () => {
      setCats(prev => prev.filter(cat => {
        const catRight = cat.x + cat.size;
        const catBottom = cat.y + cat.size;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Keep cat if any part is still on screen (with some margin)
        return cat.x > -cat.size && 
               cat.y > -cat.size && 
               catRight < screenWidth + cat.size && 
               catBottom < screenHeight + cat.size;
      }));
    };

    const interval = setInterval(checkCatsBounds, 100);
    return () => clearInterval(interval);
  }, [catsActive, cats.length]);

  // ESC key handler to stop invasion (optional - keep for convenience)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && catsActive) {
        stopCatInvasion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [catsActive]);

  // Explosion functionality
  const handleExplosionClick = () => {
    if (!explosionActive) {
      setExplosionActive(true);
      // Reset the gif to start from beginning by reloading the src
      if (explosionGifRef.current) {
        const currentSrc = explosionGifRef.current.src;
        explosionGifRef.current.src = '';
        setTimeout(() => {
          if (explosionGifRef.current) {
            explosionGifRef.current.src = currentSrc;
          }
        }, 10);
      }
      
      // Set a timeout to hide the explosion after it finishes playing
      // Most explosion GIFs are 1-3 seconds, so we'll use 5 seconds as a safe estimate
      // You can adjust this based on your actual GIF duration
      if (explosionTimeoutRef.current) {
        clearTimeout(explosionTimeoutRef.current);
      }
      explosionTimeoutRef.current = setTimeout(() => {
        setExplosionActive(false);
        explosionTimeoutRef.current = null;
      }, 5000); // 5 seconds - adjust based on your GIF duration
    }
  };

  const handleExplosionEnd = () => {
    // This won't fire for GIFs, but kept as fallback
    if (explosionTimeoutRef.current) {
      clearTimeout(explosionTimeoutRef.current);
      explosionTimeoutRef.current = null;
    }
    setExplosionActive(false);
  };

  // Hanzila globe image functionality
  const handleHanzilaClick = () => {
    // Set the hanzila image
    setGlobeImageUrl('/hanzila.png');
    
    // Clear any existing timeout
    if (globeImageTimeoutRef.current) {
      clearTimeout(globeImageTimeoutRef.current);
    }
    
    // Revert after 10 seconds
    globeImageTimeoutRef.current = setTimeout(() => {
      setGlobeImageUrl(null);
      globeImageTimeoutRef.current = null;
    }, 10000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (catIntervalRef.current) {
        clearInterval(catIntervalRef.current);
      }
      if (explosionTimeoutRef.current) {
        clearTimeout(explosionTimeoutRef.current);
      }
      if (hideButtonsTimeoutRef.current) {
        clearTimeout(hideButtonsTimeoutRef.current);
      }
      if (globeImageTimeoutRef.current) {
        clearTimeout(globeImageTimeoutRef.current);
      }
      if (masterIdleTimeoutRef.current) {
        clearTimeout(masterIdleTimeoutRef.current);
      }
    };
  }, []);

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
      {/* Button container with hover area */}
      <div
        className="button-container"
        onMouseEnter={() => {
          if (hideButtonsTimeoutRef.current) {
            clearTimeout(hideButtonsTimeoutRef.current);
            hideButtonsTimeoutRef.current = null;
          }
          setButtonsVisible(true);
        }}
        onMouseLeave={() => {
          // Add delay before hiding to make it easier to click
          hideButtonsTimeoutRef.current = setTimeout(() => {
            setButtonsVisible(false);
          }, 300);
        }}
      >
        {/* Hover area for buttons */}
        <div className="button-hover-area" />
        {/* Cat invasion button */}
        <button
          className={`cat-invasion-button ${buttonsVisible ? 'visible' : ''}`}
          onClick={catsActive ? stopCatInvasion : startCatInvasion}
          title={catsActive ? "Stop cat invasion (or press ESC)" : "Start cat invasion!"}
        >
          {catsActive ? '🐱' : '🐈'}
        </button>
        {/* Explosion button */}
        <button
          className={`explosion-button ${buttonsVisible ? 'visible' : ''}`}
          onClick={handleExplosionClick}
          title="Explosion!"
          disabled={explosionActive}
        >
          💣
        </button>
        {/* Google Careers button */}
        <button
          className={`google-careers-button ${buttonsVisible ? 'visible' : ''}`}
          onClick={() => window.open('https://www.google.com/about/careers/applications/jobs/results?target_level=INTERN_AND_APPRENTICE#!t=jo&jid=127025001&', '_blank')}
          title="Google Careers - Internships"
        >
          <span className="google-logo">G</span>
        </button>
        {/* Hanzila button */}
        <button
          className={`hanzila-button ${buttonsVisible ? 'visible' : ''}`}
          onClick={handleHanzilaClick}
          title="Change globe to Hanzila (10 seconds)"
        >
          🗺️
        </button>
      </div>
      {/* Cat overlay */}
      {catsActive && (
        <div 
          className="cat-overlay" 
          ref={catContainerRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseMove={handleMouseMove}
          style={{ cursor: isMouseDown ? 'grab' : 'default' }}
        >
          {cats.map(cat => (
            <img
              key={cat.id}
              src={cat.image}
              alt="cat"
              className="cat-image"
              style={{
                position: 'absolute',
                left: `${cat.x}px`,
                top: `${cat.y}px`,
                transform: `rotate(${cat.rotation}deg)`,
                width: `${cat.size}px`,
                height: `${cat.size}px`,
                pointerEvents: 'none',
                zIndex: 9999,
                transition: isMouseDown ? 'left 0.1s ease-out, top 0.1s ease-out' : 'none',
              }}
            />
          ))}
          {/* Visual indicator for waft radius when mouse is down */}
          {isMouseDown && (
            <div
              style={{
                position: 'absolute',
                left: `${mousePosition.x - waftRadius}px`,
                top: `${mousePosition.y - waftRadius}px`,
                width: `${waftRadius * 2}px`,
                height: `${waftRadius * 2}px`,
                borderRadius: '50%',
                border: '2px dashed rgba(252, 211, 77, 0.5)',
                pointerEvents: 'none',
                zIndex: 10000,
              }}
            />
          )}
        </div>
      )}
      {/* Explosion overlay */}
      {explosionActive && (
        <div className="explosion-overlay">
          <img
            ref={explosionGifRef}
            src="/explosion-green-screen.gif"
            alt="explosion"
            className="explosion-gif"
            onLoad={() => {
              // GIF loaded, it will play automatically
            }}
            onError={(e) => {
              console.error('Failed to load explosion GIF:', e);
              // If GIF fails to load, hide the overlay after a short delay
              setTimeout(() => {
                setExplosionActive(false);
              }, 1000);
            }}
          />
        </div>
      )}
      <div className="planning-content">
        {/* Globe as background layer - centered */}
        <div className="globe-wrapper">
          <GlobeComponent 
            roomCode={roomCode} 
            isMaster={isMaster} 
            user={user} 
            opportunityMarker={opportunityMarker}
            opportunities={paginatedOpportunities.length > 0 ? paginatedOpportunities : opportunities}
            customGlobeImage={globeImageUrl}
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
        <Chat roomCode={roomCode} userId={user?.id} masterId={masterId} paginatedOpportunities={paginatedOpportunities} opportunitiesData={opportunitiesData} />
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
          onPaginatedOpportunitiesChange={(paginatedOpps) => {
            setPaginatedOpportunities(paginatedOpps);
          }}
          onOpportunitiesDataChange={(data) => {
            setOpportunitiesData(data);
          }}
        />
      </div>
      {/* Dinosaur Game Toggle Button - only for non-master users */}
      {!isMaster && masterIdle && (
        <button
          className="dinosaur-game-toggle-button"
          onClick={() => setShowDinosaurGame(!showDinosaurGame)}
          title={showDinosaurGame ? "Hide Dinosaur Game" : "Show Dinosaur Game"}
        >
          {showDinosaurGame ? '🦕' : '🦖'}
        </button>
      )}
      {/* Dinosaur Game - only for non-master users when master is idle and toggled on */}
      {showDinosaurGame && (
        <DinosaurGame 
          isMaster={isMaster}
          masterIdle={masterIdle}
          onGameEnd={() => {
            setShowDinosaurGame(false);
          }}
        />
      )}
    </div>
  );
};

export default PlanningPage;

