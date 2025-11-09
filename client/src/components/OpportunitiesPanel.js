import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import './OpportunitiesPanel.css';

const OpportunitiesPanel = ({ roomCode, onOpportunitySelect, selectedCountry, onOpportunitiesChange, onCountrySelect }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(null);
  const [error, setError] = useState(null);
  const [showAllOpportunities, setShowAllOpportunities] = useState(true);
  const debounceTimerRef = useRef(null);

  // Load opportunities from JSON file
  useEffect(() => {
    const loadOpportunities = async () => {
      try {
        // Fetch from JSON file in public folder
        const response = await fetch('/opportunities.json');
        
        if (response.ok) {
          const data = await response.json();
          
          // Handle different JSON formats
          let opportunitiesList = [];
          if (Array.isArray(data)) {
            opportunitiesList = data;
          } else if (data.opportunities && Array.isArray(data.opportunities)) {
            opportunitiesList = data.opportunities;
          } else {
            throw new Error('Invalid JSON format');
          }

          // Validate and normalize opportunities
          const validatedOpportunities = opportunitiesList
            .map((opp, index) => {
              // Handle different field name variations
              const latlon = opp.latlon || opp.latLon || opp.coordinates || opp.coords;
              const name = opp.name || opp.Name || opp.title || opp.Title || `Opportunity ${index + 1}`;
              const link = opp.Link || opp.link || opp.url || opp.URL || '';
              const country = opp.Country || opp.country || opp.location || 'Unknown';

              // Validate latlon
              if (!Array.isArray(latlon) || latlon.length !== 2) {
                console.warn(`Invalid coordinates for opportunity ${index}:`, opp);
                return null;
              }

              const [lat, lng] = latlon;
              if (typeof lat !== 'number' || typeof lng !== 'number') {
                console.warn(`Invalid lat/lng types for opportunity ${index}:`, opp);
                return null;
              }

              return {
                id: opp.id || `opp-${index}`,
                lat,
                lng,
                name,
                link,
                country
              };
            })
            .filter(opp => opp !== null); // Remove invalid entries

          if (validatedOpportunities.length > 0) {
            setOpportunities(validatedOpportunities);
            setError(null);
            setLoading(false);
            return;
          }
        }
        
        throw new Error('Failed to load opportunities.json');
      } catch (err) {
        console.error('Error loading opportunities:', err.message);
        setError('Failed to load opportunities. Please check that opportunities.json exists.');
        setLoading(false);
      }
    };

    loadOpportunities();
  }, []);

  // Helper function to match country names
  const matchCountry = (oppCountry, selectedCountry) => {
    const opp = oppCountry?.toLowerCase().trim() || '';
    const selected = selectedCountry?.toLowerCase().trim() || '';
    
    if (!opp || !selected) return false;
    
    // Direct match
    if (opp === selected) return true;
    
    // Country name mapping for variations
    const countryGroups = [
      ['united states', 'united states of america', 'usa'],
      ['united kingdom', 'uk', 'britain', 'great britain', 'england'],
      ['russia', 'russian federation'],
      ['japan'],
      ['brazil'],
      ['india'],
      ['germany'],
      ['australia'],
      ['mexico'],
      ['china'],
      ['argentina'],
      ['egypt'],
    ];
    
    // Check if both countries are in the same group
    for (const group of countryGroups) {
      const selectedInGroup = group.some(v => v === selected);
      const oppInGroup = group.some(v => v === opp);
      if (selectedInGroup && oppInGroup) {
        return true;
      }
    }
    
    // For multi-word countries, only match if one is a substring of the other
    if (selected.includes(opp) && opp.length >= 5) {
      return true;
    }
    if (opp.includes(selected) && selected.length >= 5) {
      return true;
    }
    
    return false;
  };

  // Calculate displayed opportunities (same logic as in render)
  const getDisplayedOpportunities = () => {
    let filteredOpportunities = opportunities;
    
    // If a country is selected, filter by country
    if (selectedCountry) {
      filteredOpportunities = opportunities.filter(opp => {
        return matchCountry(opp.country, selectedCountry);
      });
    }
    
    // Then apply showAllOpportunities filter
    const displayed = showAllOpportunities 
      ? filteredOpportunities 
      : filteredOpportunities.filter(opp => opp.id === selectedOpportunityId);
    
    return displayed;
  };

  // Expose displayed opportunities to parent (not all opportunities)
  useEffect(() => {
    if (onOpportunitiesChange && opportunities.length > 0) {
      const displayed = getDisplayedOpportunities();
      onOpportunitiesChange(displayed);
    }
  }, [opportunities, selectedCountry, showAllOpportunities, selectedOpportunityId, onOpportunitiesChange]);

  // Load initial selected opportunity from database
  useEffect(() => {
    if (!roomCode) return;

    const loadSelectedOpportunity = async () => {
      const { data: room } = await supabase
        .from('rooms')
        .select('selected_opportunity_lat, selected_opportunity_lng')
        .eq('room_code', roomCode)
        .single();

      if (room?.selected_opportunity_lat && room?.selected_opportunity_lng) {
        // Find the opportunity that matches these coordinates
        const matchingOpp = opportunities.find(
          opp => 
            Math.abs(opp.lat - room.selected_opportunity_lat) < 0.01 &&
            Math.abs(opp.lng - room.selected_opportunity_lng) < 0.01
        );
        if (matchingOpp) {
          setSelectedOpportunityId(matchingOpp.id);
          // Only hide other opportunities if this was explicitly selected (not just loaded from DB)
          // We'll keep showAllOpportunities as true on initial load
        }
      }
    };

    if (opportunities.length > 0) {
      loadSelectedOpportunity();
    }
  }, [roomCode, opportunities]);

  // Real-time subscription for opportunity and country selection
  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase
      .channel(`opportunities-${roomCode}`)
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
          const oldSelectedCountry = payload.old?.selected_country;
          
          // Handle country selection changes
          if (selected_country !== oldSelectedCountry) {
            if (selected_country) {
              // Country was selected, show all opportunities in that country
              setShowAllOpportunities(true);
              setSelectedOpportunityId(null);
            } else {
              // Country was cleared
              setShowAllOpportunities(true);
              setSelectedOpportunityId(null);
            }
          }
          
          // Handle opportunity marker (only if no country is selected)
          if (selected_opportunity_lat && selected_opportunity_lng && !selected_country) {
            // Find matching opportunity
            const matchingOpp = opportunities.find(
              opp => 
                Math.abs(opp.lat - selected_opportunity_lat) < 0.01 &&
                Math.abs(opp.lng - selected_opportunity_lng) < 0.01
            );
            if (matchingOpp) {
              setSelectedOpportunityId(matchingOpp.id);
              setShowAllOpportunities(false); // Hide other opportunities
              // Trigger globe update
              if (onOpportunitySelect) {
                onOpportunitySelect(matchingOpp.lat, matchingOpp.lng, matchingOpp.name);
              }
            }
          } else if (!selected_opportunity_lat && !selected_opportunity_lng && !selected_country) {
            // Both cleared
            setSelectedOpportunityId(null);
            setShowAllOpportunities(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('Opportunities subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, opportunities, onOpportunitySelect]);

  const handleTileClick = (opportunity) => {
    // Debounce rapid clicks
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('Opportunity clicked:', opportunity);
      
      // When clicking an opportunity, select its country instead of just the opportunity
      // This will show all opportunities in that country and pan to it
      if (opportunity.country && onCountrySelect) {
        console.log('Setting country from opportunity:', opportunity.country);
        setShowAllOpportunities(true); // Show all opportunities in the country
        setSelectedOpportunityId(null); // Don't highlight a single opportunity
        
        // Set the country - this will trigger showing all opportunities in that country
        onCountrySelect(opportunity.country);
        
        // Update database to set the country and clear opportunity marker
        if (roomCode) {
          supabase
            .from('rooms')
            .update({
              selected_country: opportunity.country,
              selected_opportunity_lat: null,
              selected_opportunity_lng: null,
            })
            .eq('room_code', roomCode)
            .then(({ error }) => {
              if (error) {
                console.error('Error updating selected country from opportunity:', error);
              } else {
                console.log('Selected country from opportunity updated in database:', opportunity.country);
              }
            });
        }
      } else {
        // Fallback: if no country or callback, use old behavior
        setSelectedOpportunityId(opportunity.id);
        setShowAllOpportunities(false);
        
        if (onOpportunitySelect) {
          onOpportunitySelect(opportunity.lat, opportunity.lng, opportunity.name);
        }
        
        if (roomCode) {
          supabase
            .from('rooms')
            .update({
              selected_opportunity_lat: opportunity.lat,
              selected_opportunity_lng: opportunity.lng,
              selected_country: null,
            })
            .eq('room_code', roomCode);
        }
      }
    }, 100);
  };

  const handleBackClick = () => {
    setShowAllOpportunities(true);
    setSelectedOpportunityId(null);
    
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

    // Clear globe marker
    if (onOpportunitySelect) {
      onOpportunitySelect(null, null, null);
    }
  };

  if (loading) {
    return (
      <div className="opportunities-panel">
        <div className="opportunities-header">
          <h3>Opportunities</h3>
        </div>
        <div className="opportunities-loading">
          <p>Loading opportunities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="opportunities-panel">
        <div className="opportunities-header">
          <h3>Opportunities</h3>
        </div>
        <div className="opportunities-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Filter opportunities based on showAllOpportunities state and selected country
  let filteredOpportunities = opportunities;
  
  // If a country is selected, filter by country
  if (selectedCountry) {
    console.log('Filtering opportunities for country:', selectedCountry, 'Total opportunities:', opportunities.length);
    filteredOpportunities = opportunities.filter(opp => {
      const matches = matchCountry(opp.country, selectedCountry);
      console.log(`Checking: "${opp.name}" (${opp.country}) vs "${selectedCountry}" = ${matches}`);
      return matches;
    });
    console.log(`Filtered to ${filteredOpportunities.length} opportunities for country: ${selectedCountry}`);
    console.log('Filtered opportunities:', filteredOpportunities.map(o => ({ name: o.name, country: o.country })));
  }
  
  // Then apply showAllOpportunities filter
  const displayedOpportunities = showAllOpportunities 
    ? filteredOpportunities 
    : filteredOpportunities.filter(opp => opp.id === selectedOpportunityId);

  return (
    <div className="opportunities-panel">
      <div className="opportunities-header">
        <h3>Opportunities</h3>
        {!showAllOpportunities && (
          <button 
            className="back-button"
            onClick={handleBackClick}
            title="Back to all opportunities"
          >
            ← Back
          </button>
        )}
        {showAllOpportunities && (
          <span className="opportunities-count">
            {selectedCountry ? filteredOpportunities.length : opportunities.length}
          </span>
        )}
      </div>
      
      <div className="opportunities-list">
        {displayedOpportunities.length === 0 ? (
          <div className="opportunities-empty">
            <p>No opportunities available.</p>
          </div>
        ) : (
          displayedOpportunities.map((opp) => (
            <div
              key={opp.id}
              className={`opportunity-tile ${selectedOpportunityId === opp.id ? 'selected' : ''}`}
              onClick={() => handleTileClick(opp)}
            >
              <div className="opportunity-title">{opp.name}</div>
              <div className="opportunity-country">{opp.country}</div>
              {opp.link && (
                <a
                  href={opp.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opportunity-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  Learn more →
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OpportunitiesPanel;

