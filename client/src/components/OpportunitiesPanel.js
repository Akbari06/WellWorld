

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import './OpportunitiesPanel.css';

const OpportunitiesPanel = ({ roomCode, onOpportunitySelect, selectedCountry, onOpportunitiesChange, onCountrySelect, onPaginatedOpportunitiesChange }) => {
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
          country
        };
      })
      .filter(opp => opp !== null); // Remove invalid entries
    
    console.log(`validateAndNormalize: ${opportunitiesList.length} input, ${validated.length} validated`);
    return validated;
  };

  // Load opportunities JSON file
  useEffect(() => {
    const loadOpportunitiesData = async () => {
      try {
        // Fetch from JSON file in public folder
        const response = await fetch('/opportunities.json');
        
        if (response.ok) {
          const data = await response.json();
          
          // Store the full JSON object
          setOpportunitiesData(data);
          
          // Load "hardcode" entries on initial boot (only if no country is selected)
          // The second useEffect will handle country-specific loading
          if (data.hardcode && Array.isArray(data.hardcode)) {
            console.log('Initial load: Found hardcode entries:', data.hardcode.length);
            // Only set hardcode if no country is currently selected
            // Otherwise, let the second useEffect handle it based on selectedCountry
            if (!selectedCountry) {
              const validatedOpportunities = validateAndNormalize(data.hardcode);
              console.log('Initial load: Setting hardcode opportunities:', validatedOpportunities.length);
              setOpportunities(validatedOpportunities);
              setError(null);
            } else {
              console.log('Initial load: Country already selected, will load in second useEffect');
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
  }, []);

  // Update opportunities when country selection changes
  useEffect(() => {
    if (!opportunitiesData) {
      console.log('Update opportunities: waiting for opportunitiesData to load');
      return; // Wait for data to load
    }

    console.log('Update opportunities: selectedCountry =', selectedCountry, 'selectedOpportunityId =', selectedOpportunityId, 'opportunitiesData keys:', Object.keys(opportunitiesData));

    // If a specific opportunity is selected, don't change the opportunities list
    // This prevents reverting to hardcode when clearing country selection
    if (selectedOpportunityId) {
      console.log('Opportunity is selected, keeping current opportunities list');
      return;
    }

    if (selectedCountry) {
      // Find country key (case-insensitive search)
      const countryKey = Object.keys(opportunitiesData).find(
        key => key.toLowerCase() === selectedCountry.toLowerCase()
      );

      console.log('Country selected:', selectedCountry, 'Found key:', countryKey);

      if (countryKey && Array.isArray(opportunitiesData[countryKey])) {
        const validatedOpportunities = validateAndNormalize(opportunitiesData[countryKey]);
        console.log(`Setting opportunities for country ${countryKey}:`, validatedOpportunities.length);
        setOpportunities(validatedOpportunities);
        setError(null);
      } else {
        // Country not found in JSON, fall back to hardcode entries
        console.log(`No opportunities found for country: ${selectedCountry}, falling back to hardcode`);
        if (opportunitiesData.hardcode && Array.isArray(opportunitiesData.hardcode)) {
          const validatedOpportunities = validateAndNormalize(opportunitiesData.hardcode);
          console.log('Setting hardcode opportunities (country not found):', validatedOpportunities.length);
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
        console.log('No country selected, loading hardcode entries:', opportunitiesData.hardcode.length);
        const validatedOpportunities = validateAndNormalize(opportunitiesData.hardcode);
        console.log('Setting hardcode opportunities:', validatedOpportunities.length, 'entries:', validatedOpportunities.map(o => o.name));
        setOpportunities(validatedOpportunities);
        setError(null);
      } else {
        console.warn('No hardcode entries found in opportunitiesData');
      }
    }
  }, [selectedCountry, opportunitiesData, selectedOpportunityId]);

  // Notify parent when opportunities change
  useEffect(() => {
    if (onOpportunitiesChange) {
      console.log('Notifying parent of opportunities change:', opportunities.length);
      onOpportunitiesChange(opportunities);
    }
  }, [opportunities, onOpportunitiesChange]);

  // Reset to page 1 when opportunities change
  useEffect(() => {
    setCurrentPage(1);
  }, [opportunities.length, selectedCountry]);

  // Notify parent when paginated opportunities change (for globe display)
  // This effect runs after the component calculates displayedOpportunities
  useEffect(() => {
    if (onPaginatedOpportunitiesChange) {
      // Use the same logic as displayedOpportunities calculation
      let filteredOpportunities = opportunities;
      
      if (selectedCountry) {
        // Use the same matchCountry logic (defined below in the component)
        filteredOpportunities = opportunities.filter(opp => {
          const oppCountry = opp.country?.toLowerCase().trim() || '';
          const selected = selectedCountry?.toLowerCase().trim() || '';
          
          if (!oppCountry || !selected) return false;
          if (oppCountry === selected) return true;
          
          // Country name mapping for variations
          const countryGroups = [
            ['united states', 'united states of america', 'usa'],
            ['united kingdom', 'uk', 'britain', 'great britain', 'england'],
            ['russia', 'russian federation'],
            ['japan'], ['brazil'], ['india'], ['germany'], ['australia'],
            ['mexico'], ['china'], ['argentina'], ['egypt'],
          ];
          
          for (const group of countryGroups) {
            const selectedInGroup = group.some(v => v === selected);
            const oppInGroup = group.some(v => v === oppCountry);
            if (selectedInGroup && oppInGroup) return true;
          }
          
          if (selected.includes(oppCountry) && oppCountry.length >= 5) return true;
          if (oppCountry.includes(selected) && selected.length >= 5) return true;
          
          return false;
        });
      }
      
      const displayedOpps = showAllOpportunities 
        ? filteredOpportunities 
        : filteredOpportunities.filter(opp => opp.id === selectedOpportunityId);
      
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedOpps = displayedOpps.slice(startIndex, endIndex);
      
      onPaginatedOpportunitiesChange(paginatedOpps);
    }
  }, [currentPage, opportunities, selectedCountry, showAllOpportunities, selectedOpportunityId, onPaginatedOpportunitiesChange]);

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
          const oldLat = payload.old?.selected_opportunity_lat;
          const oldLng = payload.old?.selected_opportunity_lng;
          
          // Handle country selection changes
          if (selected_country !== oldSelectedCountry) {
            if (selected_country) {
              // Country was selected, show all opportunities in that country
              setShowAllOpportunities(true);
              setSelectedOpportunityId(null);
            } else if (!selected_opportunity_lat && !selected_opportunity_lng) {
              // Country was cleared AND no opportunity is selected - reset to show all
              setShowAllOpportunities(true);
              setSelectedOpportunityId(null);
            }
            // If country was cleared but opportunity is selected, keep the opportunity selected
          }
          
          // Handle opportunity marker (only if no country is selected)
          if (selected_opportunity_lat && selected_opportunity_lng && !selected_country) {
            // Only update if the opportunity actually changed
            if (selected_opportunity_lat !== oldLat || selected_opportunity_lng !== oldLng) {
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
      
      // Always select the specific opportunity when clicked
      // This will show only that one opportunity on the globe
      setSelectedOpportunityId(opportunity.id);
      setShowAllOpportunities(false);
      
      // Clear country selection when a specific opportunity is selected
      if (onCountrySelect) {
        onCountrySelect(null);
      }
      
      // Notify parent of the selected opportunity
      if (onOpportunitySelect) {
        onOpportunitySelect(opportunity.lat, opportunity.lng, opportunity.name);
      }
      
      // Update database to set the opportunity marker and clear country selection
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
              console.log('Selected opportunity updated in database:', opportunity.name);
            }
          });
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

  // Helper function to match country names
  // Handles variations between GeoJSON country names and opportunity country names
  const matchCountry = (oppCountry, selectedCountry) => {
    const opp = oppCountry?.toLowerCase().trim() || '';
    const selected = selectedCountry?.toLowerCase().trim() || '';
    
    if (!opp || !selected) return false;
    
    // Direct match
    if (opp === selected) return true;
    
    // Country name mapping for variations
    // Each array contains all valid names for that country
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
    // This handles "United States" matching "United States of America"
    // But only if the shorter one is completely contained in the longer one
    if (selected.includes(opp) && opp.length >= 5) {
      // "united states" is contained in "united states of america"
      return true;
    }
    if (opp.includes(selected) && selected.length >= 5) {
      // "united states of america" contains "united states"
      return true;
    }
    
    return false;
  };

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

  // Calculate pagination
  const totalPages = Math.ceil(displayedOpportunities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOpportunities = displayedOpportunities.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

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
          <>
            {paginatedOpportunities.map((opp) => (
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
            ))}
            
            {/* Pagination Controls */}
            {displayedOpportunities.length > itemsPerPage && (
              <div className="pagination-controls">
                <button
                  className="pagination-button"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  title="Previous page"
                >
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="pagination-button"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
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
