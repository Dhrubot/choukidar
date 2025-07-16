/**
 * Geographic Utilities Module
 * 
 * Contains mathematical calculations and geographic utility functions
 * extracted from the original monolithic API service.
 */

/**
 * Calculate distance between two points using the Haversine formula
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Calculate route safety score based on nearby safe zones
 * 
 * @param {Array} safeZones - Array of safe zone objects with properties.safetyScore
 * @returns {number} Safety score (0-10 scale, rounded to 1 decimal place)
 */
export function calculateRouteSafetyScore(safeZones) {
  if (safeZones.length === 0) return 3; // Low safety if no safe zones

  const avgSafety = safeZones.reduce((sum, zone) => 
    sum + zone.properties.safetyScore, 0) / safeZones.length;
  
  const coverage = Math.min(safeZones.length / 3, 1); // Normalize coverage (max 3 zones = full coverage)
  
  return Math.round((avgSafety * 0.7 + coverage * 10 * 0.3) * 10) / 10;
}

// Default export for convenience
export default {
  calculateDistance,
  calculateRouteSafetyScore
};