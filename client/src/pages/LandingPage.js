import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './LandingPage.css';

const UserIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const LandingPage = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicRooms, setPublicRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [expandedDescription, setExpandedDescription] = useState(null);
  const [language, setLanguage] = useState('en');
  const [activeTab, setActiveTab] = useState('create');
  // room name input removed from UI; names will default to Room <CODE> on creation
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'pt', label: 'Português' },
  ];

  const translations = {
    en: {
      languageLabel: 'Language',
      heroEyebrow: 'Plan journeys that create authentic change',
      heroTitle: 'Plan Your Impact Journey',
      heroCopy:
        'Connect with others to discover wellbeing-focused travel experiences that create positive social impact. No resorts. No tourism. Just meaningful connections and authentic change.',
      createTab: 'Create Room',
      joinTab: 'Join Room',
      createCardTitle: 'Create a New Room',
      createCardSubtitle: 'Start a private planning session with your group.',
      roomNameLabel: 'Room Name',
      roomNamePlaceholder: 'e.g., Peru Wellbeing Adventure',
      createButton: 'Create Room',
      joinCardTitle: 'Join an Existing Room',
      joinCardSubtitle: 'Already have a code? Jump into your team’s planning room.',
      joinCardButton: 'Go to Join Room',
      publicRoomsTitle: 'Public Rooms',
      publicRoomsSubtitle: 'Join open rooms and connect with like-minded travelers.',
      loadingRooms: 'Loading public rooms...',
      noPublicRooms: 'No public rooms available at the moment.',
    },
    es: {
      languageLabel: 'Idioma',
      heroEyebrow: 'Planifica viajes que generen cambio auténtico',
      heroTitle: 'Planifica Tu Viaje de Impacto',
      heroCopy:
        'Conecta con otros para descubrir experiencias de viaje enfocadas en el bienestar que crean impacto social positivo. Sin resorts. Sin turismo masivo. Solo conexiones significativas y cambio auténtico.',
      createTab: 'Crear Sala',
      joinTab: 'Unirse a Sala',
      createCardTitle: 'Crea una Nueva Sala',
      createCardSubtitle: 'Inicia una sesión privada de planificación con tu grupo.',
      roomNameLabel: 'Nombre de la Sala',
      roomNamePlaceholder: 'p. ej., Aventura de Bienestar en Perú',
      createButton: 'Crear Sala',
      joinCardTitle: 'Únete a una Sala',
      joinCardSubtitle: '¿Ya tienes un código? Ingresa a la sala de tu equipo.',
      joinCardButton: 'Ir a Unirse',
      publicRoomsTitle: 'Salas Públicas',
      publicRoomsSubtitle: 'Únete a salas abiertas y conecta con otros viajeros.',
      loadingRooms: 'Cargando salas públicas...',
      noPublicRooms: 'No hay salas públicas disponibles por ahora.',
    },
    fr: {
      languageLabel: 'Langue',
      heroEyebrow: 'Planifiez des voyages qui créent un vrai changement',
      heroTitle: 'Planifiez Votre Voyage à Impact',
      heroCopy:
        'Connectez-vous avec d’autres pour découvrir des expériences axées sur le bien-être qui génèrent un impact social positif. Pas de resorts. Pas de tourisme de masse. Seulement des liens authentiques.',
      createTab: 'Créer une Salle',
      joinTab: 'Rejoindre une Salle',
      createCardTitle: 'Créer une Nouvelle Salle',
      createCardSubtitle: 'Lancez une session de planification privée avec votre groupe.',
      roomNameLabel: 'Nom de la Salle',
      roomNamePlaceholder: 'ex., Aventure Bien-Être au Pérou',
      createButton: 'Créer la Salle',
      joinCardTitle: 'Rejoindre une Salle Existante',
      joinCardSubtitle: 'Vous avez déjà un code ? Rejoignez votre équipe.',
      joinCardButton: 'Aller à Rejoindre',
      publicRoomsTitle: 'Salles Publiques',
      publicRoomsSubtitle: 'Rejoignez des salles ouvertes et connectez-vous avec d’autres voyageurs.',
      loadingRooms: 'Chargement des salles publiques...',
      noPublicRooms: 'Aucune salle publique disponible pour le moment.',
    },
    de: {
      languageLabel: 'Sprache',
      heroEyebrow: 'Plane Reisen, die echten Wandel schaffen',
      heroTitle: 'Plane Deine Impact-Reise',
      heroCopy:
        'Vernetze dich mit anderen, um Wohlfühlreisen zu entdecken, die positiven sozialen Einfluss haben. Keine Resorts. Kein Massentourismus. Nur echte Verbindungen und Veränderung.',
      createTab: 'Raum Erstellen',
      joinTab: 'Raum Beitreten',
      createCardTitle: 'Neuen Raum Erstellen',
      createCardSubtitle: 'Starte eine private Planungssitzung mit deiner Gruppe.',
      roomNameLabel: 'Raumname',
      roomNamePlaceholder: 'z. B. Peru Wohlfühlreise',
      createButton: 'Raum Erstellen',
      joinCardTitle: 'Bestehendem Raum Beitreten',
      joinCardSubtitle: 'Hast du schon einen Code? Tritt dem Raum deines Teams bei.',
      joinCardButton: 'Zum Beitritt',
      publicRoomsTitle: 'Öffentliche Räume',
      publicRoomsSubtitle: 'Tritt offenen Räumen bei und vernetze dich mit Gleichgesinnten.',
      loadingRooms: 'Öffentliche Räume werden geladen...',
      noPublicRooms: 'Aktuell sind keine öffentlichen Räume verfügbar.',
    },
    pt: {
      languageLabel: 'Idioma',
      heroEyebrow: 'Planeje viagens que geram mudança autêntica',
      heroTitle: 'Planeje Sua Jornada de Impacto',
      heroCopy:
        'Conecte-se com outras pessoas para descobrir experiências de viagem focadas em bem-estar que criam impacto social positivo. Sem resorts. Sem turismo. Apenas conexões significativas e mudança real.',
      createTab: 'Criar Sala',
      joinTab: 'Entrar na Sala',
      createCardTitle: 'Criar Nova Sala',
      createCardSubtitle: 'Inicie uma sessão privada de planejamento com seu grupo.',
      roomNameLabel: 'Nome da Sala',
      roomNamePlaceholder: 'ex.: Aventura de Bem-Estar no Peru',
      createButton: 'Criar Sala',
      joinCardTitle: 'Entrar em uma Sala',
      joinCardSubtitle: 'Já tem um código? Entre na sala do seu time.',
      joinCardButton: 'Ir para Entrar',
      publicRoomsTitle: 'Salas Públicas',
      publicRoomsSubtitle: 'Entre em salas abertas e conecte-se com outros viajantes.',
      loadingRooms: 'Carregando salas públicas...',
      noPublicRooms: 'Nenhuma sala pública disponível no momento.',
    },
  };

  const copy = translations[language] || translations.en;
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    return localStorage.getItem('landingTheme') || 'dark';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('landingTheme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleCreateRoom = async () => {
    if (!user) {
      setError('Please sign in to create a room.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current user ID
      const currentUserId = user.id;

      // Generate unique 6-digit alphanumeric code
      let roomCode;
      let codeExists = true;
      let attempts = 0;
      const maxAttempts = 10;

      while (codeExists && attempts < maxAttempts) {
        // Generate random 6-character code (A-Z, 0-9)
        roomCode = Array.from({ length: 6 }, () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('');

        // Check if code exists
        const { data: existing, error: checkError } = await supabase
          .from('rooms')
          .select('room_code')
          .eq('room_code', roomCode)
          .maybeSingle();

        codeExists = !!existing && !checkError;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique room code');
      }

            // Create room
      // No room name input in UI — use default name based on generated code
      const sanitizedRoomName = '';

      const { data: room, error: createError } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          master_id: currentUserId,
          name: sanitizedRoomName || `Room ${roomCode}`,
          is_public: false,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Add creator as master participant
      const { error: participantError } = await supabase
        .from('room_participants')
        .insert({
          room_code: room.room_code,
          user_id: room.master_id,
          is_master: true,
        });

      if (participantError) {
        console.error('Error adding participant:', participantError);
        // Still navigate even if participant insert fails
      }

      navigate(`/room/${room.room_code}`);
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = () => {
    navigate('/join');
  };

  useEffect(() => {
    loadPublicRooms();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('landing-public-rooms')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: 'is_public=eq.true',
        },
        () => {
          loadPublicRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPublicRooms = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      // Get participant counts and creator usernames for each room
      const roomsWithCounts = await Promise.all(
        (data || []).map(async (room) => {
          const { count } = await supabase
            .from('room_participants')
            .select('*', { count: 'exact', head: true })
            .eq('room_code', room.room_code);

          // Get creator's username (or email as fallback)
          let creatorUsername = null;
          try {
            const { data: creatorProfile, error: profileError } = await supabase
              .from('profiles')
              .select('username, email')
              .eq('id', room.master_id)
              .maybeSingle();
            
            if (!profileError && creatorProfile) {
              // Use username if available, otherwise use email prefix, otherwise use email
              creatorUsername = creatorProfile.username || 
                               creatorProfile.email?.split('@')[0] || 
                               creatorProfile.email || 
                               null;
            }
          } catch (err) {
            console.error('Error fetching creator profile:', err);
          }

          return {
            ...room,
            participant_count: count || 0,
            creator_username: creatorUsername,
          };
        })
      );

      setPublicRooms(roomsWithCounts);
    } catch (err) {
      console.error('Error loading public rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleJoinPublicRoom = async (roomCode) => {
    try {
      if (!user) {
        setError('Please sign in to join a room.');
        return;
      }

      const currentUser = user;

      // Check if room exists and get planning status
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('planning_started')
        .eq('room_code', roomCode)
        .single();

      if (roomError || !room) {
        setError('Room not found or has been deleted.');
        // Reload public rooms list to remove deleted room
        loadPublicRooms();
        return;
      }

      // If planning has already started, redirect to planning page immediately
      if (room.planning_started) {
        const { data: existing } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_code', roomCode)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from('room_participants')
            .insert({
              room_code: roomCode,
              user_id: currentUser.id,
              is_master: false,
            });
        }

        navigate(`/planning/${roomCode}`);
        return;
      }

      // Check current participant count
      const { count: participantCount } = await supabase
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_code', roomCode);

      // Check if room is full (max 4 people)
      if (participantCount >= 4) {
        setError('Room is full. Maximum 4 people allowed per room.');
        return;
      }

      // Check if user is already in the room
      const { data: existing } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_code', roomCode)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      // Only insert if user is not already in the room
      if (!existing) {
        const { error: joinError } = await supabase
          .from('room_participants')
          .insert({
            room_code: roomCode,
            user_id: currentUser.id,
            is_master: false,
          });

        if (joinError && joinError.code !== '23505') {
          throw joinError;
        }
      }

      navigate(`/room/${roomCode}`);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please try again.');
    }
  };

  return (
    <div className={`landing-page ${theme}`}>
      <div className="landing-shell">
        <header className="landing-nav">
          <div className="brand-cluster">
            <div className="brand-mark">
              <img src="/favicon.ico" alt="WellWorld Logo" />
            </div>
            <div className="brand-copy">
              <span className="brand-name">WellWorld</span>
              <span className="brand-tagline">Wellbeing through Social Good</span>
            </div>
          </div>
          <div className="nav-actions">
            <div className="language-control">
              <div className="language-select-wrapper">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  aria-label="Select language"
                >
                  {languageOptions.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle light and dark mode"
            >
              <span className="theme-icon" aria-hidden="true">
                {theme === 'dark' ? '☀️' : '🌙'}
              </span>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            {user && (
              <div className="profile-section-top">
                <div className="profile-info">
                  <UserIcon className="profile-icon" />
                  <span className="profile-email">{user.email}</span>
                </div>
                <button
                  className="btn-profile-signout"
                  onClick={async () => {
                    await supabase.auth.signOut();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="landing-main-card">
          <section className="hero">
            <p className="hero-eyebrow">{copy.heroEyebrow}</p>
            <h1>{copy.heroTitle}</h1>
            <p className="hero-copy">{copy.heroCopy}</p>
          </section>

          {error && <div className="error-message">{error}</div>}

          <div className="action-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'create'}
              className={`action-tab ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              {copy.createTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'join'}
              className={`action-tab ${activeTab === 'join' ? 'active' : ''}`}
              onClick={() => setActiveTab('join')}
            >
              {copy.joinTab}
            </button>
          </div>

          {activeTab === 'create' ? (
            <section className="card create-card">
              <div className="card-header">
                <div className="card-icon">+</div>
                <div>
                  <h3>{copy.createCardTitle}</h3>
                  <p>{copy.createCardSubtitle}</p>
                </div>
              </div>
<button
                className="btn btn-primary"
                onClick={handleCreateRoom}
                disabled={loading}
              >
                {loading ? `${copy.createButton}...` : copy.createButton}
              </button>
            </section>
          ) : (
            <section className="card join-card">
              <div className="card-header">
                <div className="card-icon">⇢</div>
                <div>
                  <h3>{copy.joinCardTitle}</h3>
                  <p>{copy.joinCardSubtitle}</p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleJoinRoom}
                disabled={loading}
              >
                {copy.joinCardButton}
              </button>
            </section>
          )}

          <div className="public-rooms-section">
            <h2 className="public-rooms-title">{copy.publicRoomsTitle}</h2>
            <p className="public-rooms-subtitle">
              {copy.publicRoomsSubtitle}
            </p>

            {loadingRooms ? (
              <div className="loading-rooms">{copy.loadingRooms}</div>
            ) : publicRooms.length === 0 ? (
              <div className="no-public-rooms">
                <p>{copy.noPublicRooms}</p>
              </div>
            ) : (
              <div className="public-rooms-list">
                {publicRooms.map((room) => (
                  <div key={room.id} className="public-room-card">
                    <div className="public-room-info">
                      <div className="public-room-header">
                        <h3 className="public-room-name">
                          {room.name || `Room ${room.room_code}`}
                        </h3>
                        {room.description && (
                          <button
                            className="btn-dots"
                            onClick={() =>
                              setExpandedDescription(
                                expandedDescription === room.id ? null : room.id
                              )
                            }
                            aria-label="Show description"
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="public-room-code">Code: {room.room_code}</p>
                      <p className="public-room-meta">
                        {room.participant_count} member{room.participant_count !== 1 ? 's' : ''} • Active now
                        {room.creator_username ? (
                          <span className="public-room-creator">
                            {' • Created by '}
                            <span className="creator-name">{room.creator_username}</span>
                          </span>
                        ) : (
                          <span className="public-room-creator">
                            {' • Created by '}
                            <span className="creator-name">Unknown</span>
                          </span>
                        )}
                      </p>
                      {expandedDescription === room.id && room.description && (
                        <div className="public-room-description">
                          <p>{room.description}</p>
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-join-public"
                      onClick={() => handleJoinPublicRoom(room.room_code)}
                      disabled={loading}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LandingPage;
