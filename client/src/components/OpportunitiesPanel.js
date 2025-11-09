import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import './OpportunitiesPanel.css';

const OpportunitiesPanel = ({
  roomCode,
  onOpportunitySelect,
  selectedCountry,
  onOpportunitiesChange,
  onCountrySelect,
  onPaginatedOpportunitiesChange,
  onOpportunitiesDataChange,
}) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(null);
  const [error, setError] = useState(null);
  const [showAllOpportunities, setShowAllOpportunities] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const debounceTimerRef = useRef(null);

  // Store the full JSON data
  const [opportunitiesData, setOpportunitiesData] = useState(null);

  // Keep a ref to the latest opportunities so realtime subscription handlers
  // don't require re-subscribing when opportunities array identity changes
  const opportunitiesRef = useRef(opportunities);
  useEffect(() => {
    opportunitiesRef.current = opportunities;
  }, [opportunities]);

  // Helper function to validate and normalize opportunities
  const validateAndNormalize = (opportunitiesList) => {
    if (!Array.isArray(opportunitiesList)) {
      console.warn('validateAndNormalize: opportunitiesList is not an array:', opportunitiesList);
      return [];
    }

    const validated = opportunitiesList
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
          country,
        };
      })
      .filter((opp) => opp !== null); // Remove invalid entries

    console.debug(`validateAndNormalize: ${opportunitiesList.length} input, ${validated.length} validated`);
    return validated;
  };

  // Load opportunities JSON file
  useEffect(() => {
    const loadOpportunitiesData = async () => {
      try {
        const response = await fetch('/opportunities.json');

        if (response.ok) {
          const data = await response.json();

          // Store the full JSON object
          setOpportunitiesData(data);
          
          // Notify parent of the full JSON data
          if (onOpportunitiesDataChange) {
            onOpportunitiesDataChange(data);
          }

          if (data.hardcode && Array.isArray(data.hardcode)) {
            // Only set hardcode if no country is currently selected
            if (!selectedCountry) {
              const validatedOpportunities = validateAndNormalize(data.hardcode);
              setOpportunities(validatedOpportunities);
              setError(null);
            }
            setLoading(false);
          } else {
            throw new Error('No "hardcode" entries found in JSON');
          }
        } else {
          throw new Error('Failed to load opportunities.json');
        }
      } catch (err) {
        console.error('Error loading opportunities:', err.message);
        setError('Failed to load opportunities. Please check that opportunities.json exists.');
        setLoading(false);
      }
    };

    loadOpportunitiesData();
    // Note: selectedCountry intentionally not included here to avoid reloading file for every country change
  }, []);

  // Update opportunities when country selection changes or on initial opportunitiesData load.
  // This effect only runs when selectedCountry or opportunitiesData (the source JSON) changes.
  useEffect(() => {
    if (!opportunitiesData) return;

    // If a specific opportunity is selected, don't change the opportunities list
    if (selectedOpportunityId) return;

    if (selectedCountry) {
      // Find country key (case-insensitive search)
      const countryKey = Object.keys(opportunitiesData).find(
        (key) => key.toLowerCase() === selectedCountry.toLowerCase()
      );

      if (countryKey && Array.isArray(opportunitiesData[countryKey])) {
        const validatedOpportunities = validateAndNormalize(opportunitiesData[countryKey]);
        setOpportunities(validatedOpportunities);
        setError(null);
      } else {
        // Country not found in JSON, fall back to hardcode entries
        if (opportunitiesData.hardcode && Array.isArray(opportunitiesData.hardcode)) {
          const validatedOpportunities = validateAndNormalize(opportunitiesData.hardcode);
          setOpportunities(validatedOpportunities);
          setError(null);
        } else {
          setOpportunities([]);
          setError(null);
        }
      }
    } else {
      // No country selected, show "hardcode" entries (only if no opportunity is selected)
      if (opportunitiesData.hardcode && Array.isArray(opportunitiesData.hardcode)) {
        const validatedOpportunities = validateAndNormalize(opportunitiesData.hardcode);
        setOpportunities(validatedOpportunities);
        setError(null);
      } else {
        console.warn('No hardcode entries found in opportunitiesData');
      }
    }
    // Reset to first page whenever the source opportunities set changes
    setCurrentPage(1);
  }, [selectedCountry, opportunitiesData, selectedOpportunityId]);

  // Notify parent when opportunities change (this is still useful)
  useEffect(() => {
    if (onOpportunitiesChange) {
      onOpportunitiesChange(opportunities);
      console.debug('Notified parent of opportunities change:', opportunities.length);
    }
  }, [opportunities, onOpportunitiesChange]);

  // When the list of opportunities changes, reset to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [opportunities.length, selectedCountry]);

  // Helper function to match country names
  const matchCountry = (oppCountry, selectedCountryStr) => {
    const opp = oppCountry?.toLowerCase().trim() || '';
    const selected = selectedCountryStr?.toLowerCase().trim() || '';

    if (!opp || !selected) return false;
    if (opp === selected) return true;

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

    for (const group of countryGroups) {
      const selectedInGroup = group.some((v) => v === selected);
      const oppInGroup = group.some((v) => v === opp);
      if (selectedInGroup && oppInGroup) return true;
    }

    if (selected.includes(opp) && opp.length >= 5) return true;
    if (opp.includes(selected) && selected.length >= 5) return true;

    return false;
  };

  // Memoize filtered opportunities so we only compute this when inputs change
  const filteredOpportunities = useMemo(() => {
    if (!selectedCountry) return opportunities;

    const filtered = opportunities.filter((opp) => matchCountry(opp.country, selectedCountry));
    console.debug(`Filtered opportunities for country "${selectedCountry}": ${filtered.length}`);
    return filtered;
    // only re-run when opportunities array or selectedCountry value changes
  }, [opportunities, selectedCountry]);

  // Compute displayed opportunities (either all filtered or only the selected one)
  const displayedOpportunities = useMemo(() => {
    return showAllOpportunities ? filteredOpportunities : filteredOpportunities.filter((opp) => opp.id === selectedOpportunityId);
  }, [filteredOpportunities, showAllOpportunities, selectedOpportunityId]);

  // Pagination calculation (memoized)
  const paginatedOpportunities = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayedOpportunities.slice(startIndex, startIndex + itemsPerPage);
  }, [displayedOpportunities, currentPage]);

  // Notify parent when paginated opportunities change — but only if they actually changed.
  const lastPaginatedJSONRef = useRef(null);
  useEffect(() => {
    if (!onPaginatedOpportunitiesChange) return;

    const currentJSON = JSON.stringify(paginatedOpportunities);
    if (lastPaginatedJSONRef.current !== currentJSON) {
      lastPaginatedJSONRef.current = currentJSON;
      onPaginatedOpportunitiesChange(paginatedOpportunities);
      console.debug('onPaginatedOpportunitiesChange fired. paginated length=', paginatedOpportunities.length);
    } else {
      // No change — do nothing (stops infinite loops caused by repeated identical events)
    }
  }, [paginatedOpportunities, onPaginatedOpportunitiesChange]);

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
          (opp) =>
            Math.abs(opp.lat - room.selected_opportunity_lat) < 0.01 &&
            Math.abs(opp.lng - room.selected_opportunity_lng) < 0.01
        );
        if (matchingOpp) {
          setSelectedOpportunityId(matchingOpp.id);
        }
      }
    };

    if (opportunities.length > 0) {
      loadSelectedOpportunity();
    }
  }, [roomCode, opportunities]);

  // Real-time subscription for opportunity and country selection.
  // NOTE: we purposefully do NOT include `opportunities` in the deps to avoid re-subscribing.
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
          const oldLat = payload.old?.selected_opportunity_lat;
          const oldLng = payload.old?.selected_opportunity_lng;

          // Handle country selection changes (only act if changed)
          if (selected_country !== oldSelectedCountry) {
            if (selected_country) {
              setShowAllOpportunities(true);
              setSelectedOpportunityId(null);
            } else if (!selected_opportunity_lat && !selected_opportunity_lng) {
              setShowAllOpportunities(true);
              setSelectedOpportunityId(null);
            }
          }

          // Handle opportunity marker (only if no country is selected)
          if (selected_opportunity_lat && selected_opportunity_lng && !selected_country) {
            if (selected_opportunity_lat !== oldLat || selected_opportunity_lng !== oldLng) {
              // Use the ref to access the latest opportunities without re-subscribing
              const matchingOpp = (opportunitiesRef.current || []).find(
                (opp) =>
                  Math.abs(opp.lat - selected_opportunity_lat) < 0.01 &&
                  Math.abs(opp.lng - selected_opportunity_lng) < 0.01
              );
              if (matchingOpp) {
                setSelectedOpportunityId(matchingOpp.id);
                setShowAllOpportunities(false);
                if (onOpportunitySelect) {
                  onOpportunitySelect(matchingOpp.lat, matchingOpp.lng, matchingOpp.name);
                }
              }
            }
          } else if (!selected_opportunity_lat && !selected_opportunity_lng && !selected_country) {
            setSelectedOpportunityId(null);
            setShowAllOpportunities(true);
          }
        }
      )
      .subscribe((status) => {
        console.debug('Opportunities subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // only resubscribe when roomCode or onOpportunitySelect changes
  }, [roomCode, onOpportunitySelect]);

  const handleTileClick = (opportunity) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSelectedOpportunityId(opportunity.id);
      setShowAllOpportunities(false);

      // Clear country selection when a specific opportunity is selected
      if (onCountrySelect) {
        onCountrySelect(null);
      }

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
          .eq('room_code', roomCode)
          .then(({ error }) => {
            if (error) {
              console.error('Error updating selected opportunity:', error);
            } else {
              console.debug('Selected opportunity updated in database:', opportunity.name);
            }
          });
      }
    }, 100);
  };

  const handleBackClick = () => {
    setShowAllOpportunities(true);
    setSelectedOpportunityId(null);

    if (roomCode) {
      supabase
        .from('rooms')
        .update({
          selected_opportunity_lat: null,
          selected_opportunity_lng: null,
        })
        .eq('room_code', roomCode);
    }

    if (onOpportunitySelect) {
      onOpportunitySelect(null, null, null);
    }
  };

  const handleSelectThis = (opportunity, e) => {
    e.stopPropagation(); // Prevent tile click
    
    // Show congrats message
    alert(`Congratulations! You've selected "${opportunity.name}". The globe will reset to its default position.`);
    
    // Clear country selection first (this ensures the reset condition is met)
    if (onCountrySelect) {
      onCountrySelect(null);
    }
    
    // First, ensure the opportunity marker is set (if not already set)
    // This ensures that hadOpportunity will be true when we clear it, triggering the reset
    if (onOpportunitySelect) {
      onOpportunitySelect(opportunity.lat, opportunity.lng, opportunity.name);
    }
    
    // Clear opportunity selection locally
    setSelectedOpportunityId(null);
    setShowAllOpportunities(true);
    
    // Clear opportunity marker from database (including country)
    if (roomCode) {
      supabase
        .from('rooms')
        .update({
          selected_opportunity_lat: null,
          selected_opportunity_lng: null,
          selected_country: null,
        })
        .eq('room_code', roomCode);
    }

    // Now clear the globe marker after a short delay
    // This ensures the opportunity marker was set first, so hadOpportunity will be true
    // The globe reset requires both opportunity and country to be cleared
    setTimeout(() => {
      if (onOpportunitySelect) {
        onOpportunitySelect(null, null, null);
      }
    }, 100);
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

  // Calculate pagination UI values
  const totalPages = Math.max(1, Math.ceil(displayedOpportunities.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const visiblePaginated = displayedOpportunities.slice(startIndex, endIndex);

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const handlePreviousPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  return (
    <div className="opportunities-panel">
      <div className="opportunities-header">
        <h3>Opportunities</h3>
        {!showAllOpportunities && (
          <button className="back-button" onClick={handleBackClick} title="Back to all opportunities">
            ← Back
          </button>
        )}
        {showAllOpportunities && <span className="opportunities-count">{selectedCountry ? filteredOpportunities.length : opportunities.length}</span>}
      </div>

      <div className="opportunities-list">
        {displayedOpportunities.length === 0 ? (
          <div className="opportunities-empty">
            <p>No opportunities available.</p>
          </div>
        ) : (
          <>
            {visiblePaginated.map((opp) => (
              <div
                key={opp.id}
                className={`opportunity-tile ${selectedOpportunityId === opp.id ? 'selected' : ''}`}
                onClick={() => handleTileClick(opp)}
              >
                <div className="opportunity-title">{opp.name}</div>
                <div className="opportunity-country">{opp.country}</div>
                <div className="opportunity-actions">
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
                  <button
                    className="opportunity-select-button"
                    onClick={(e) => handleSelectThis(opp, e)}
                  >
                    Select this
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {displayedOpportunities.length > itemsPerPage && (
              <div className="pagination-controls">
                <button className="pagination-button" onClick={handlePreviousPage} disabled={currentPage === 1} title="Previous page">
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button className="pagination-button" onClick={handleNextPage} disabled={currentPage === totalPages} title="Next page">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OpportunitiesPanel;