/**
 * Test file for Geographic Utilities
 * 
 * Simple tests to verify the mathematical calculations work correctly
 */

import { calculateDistance, calculateRouteSafetyScore } from './geoUtils.js';

// Test calculateDistance function
function testCalculateDistance() {
  console.log('Testing calculateDistance...');
  
  // Test case 1: Distance between two known points
  // London to Paris (approximately 344 km)
  const londonLat = 51.5074;
  const londonLng = -0.1278;
  const parisLat = 48.8566;
  const parisLng = 2.3522;
  
  const distance = calculateDistance(londonLat, londonLng, parisLat, parisLng);
  console.log(`Distance London to Paris: ${Math.round(distance / 1000)} km`);
  
  // Test case 2: Same point should return 0
  const samePointDistance = calculateDistance(londonLat, londonLng, londonLat, londonLng);
  console.log(`Distance same point: ${samePointDistance} meters`);
  
  // Test case 3: Short distance (1 degree difference)
  const shortDistance = calculateDistance(0, 0, 1, 1);
  console.log(`Distance 1 degree: ${Math.round(shortDistance)} meters`);
  
  return distance > 300000 && distance < 400000 && samePointDistance === 0;
}

// Test calculateRouteSafetyScore function
function testCalculateRouteSafetyScore() {
  console.log('Testing calculateRouteSafetyScore...');
  
  // Test case 1: No safe zones
  const noZonesScore = calculateRouteSafetyScore([]);
  console.log(`No safe zones score: ${noZonesScore}`);
  
  // Test case 2: One safe zone with high safety
  const oneZoneScore = calculateRouteSafetyScore([
    { properties: { safetyScore: 8 } }
  ]);
  console.log(`One high safety zone score: ${oneZoneScore}`);
  
  // Test case 3: Multiple safe zones
  const multiZoneScore = calculateRouteSafetyScore([
    { properties: { safetyScore: 7 } },
    { properties: { safetyScore: 8 } },
    { properties: { safetyScore: 6 } }
  ]);
  console.log(`Multiple zones score: ${multiZoneScore}`);
  
  return noZonesScore === 3 && oneZoneScore > 5 && multiZoneScore > 6;
}

// Run tests
function runTests() {
  console.log('=== Geographic Utils Tests ===');
  
  const distanceTestPassed = testCalculateDistance();
  const safetyTestPassed = testCalculateRouteSafetyScore();
  
  console.log('\n=== Test Results ===');
  console.log(`Distance calculation test: ${distanceTestPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Safety score calculation test: ${safetyTestPassed ? 'PASSED' : 'FAILED'}`);
  
  const allTestsPassed = distanceTestPassed && safetyTestPassed;
  console.log(`\nOverall: ${allTestsPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  return allTestsPassed;
}

// Export for use in other test files or run directly
export { runTests };

// Run tests if this file is executed directly
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}