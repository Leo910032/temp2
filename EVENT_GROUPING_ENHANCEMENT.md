# Event Grouping Enhancement - GPS Proximity Check

## Overview

The event grouping logic has been enhanced to require **both time proximity AND GPS proximity** for more accurate event detection. This prevents false positives where contacts are added at similar times but in completely different locations.

---

## Changes Made

### 1. Configuration Constants Updated

```javascript
// BEFORE:
const LOCATION_CLUSTER_THRESHOLD_KM = 0.5; // 500m radius
const EVENT_DETECTION_THRESHOLD_HOURS = 4; // 4-hour max gap

// AFTER:
const LOCATION_CLUSTER_THRESHOLD_KM = 1.0; // 1km radius (UPDATED)
const EVENT_DETECTION_THRESHOLD_HOURS = 4; // 4-hour max gap (unchanged)
const EVENT_PROXIMITY_THRESHOLD_KM = 1.0; // NEW - Events must be within 1km
```

**Changes:**
- ✅ `LOCATION_CLUSTER_THRESHOLD_KM`: Increased from **0.5 km** to **1.0 km**
- ✅ `EVENT_PROXIMITY_THRESHOLD_KM`: **New constant** set to **1.0 km**

---

### 2. Enhanced Event Detection Logic

The event grouping method now implements a **two-factor verification** system:

#### Old Logic (Time-Only):
```javascript
// OLD: Only checked time
if (timeDiff <= EVENT_DETECTION_THRESHOLD_HOURS) {
  currentEventGroup.push(nextContact);
}
```

#### New Logic (Time + GPS):
```javascript
// NEW: Checks BOTH time AND GPS distance
if (timeDiff <= EVENT_DETECTION_THRESHOLD_HOURS) {
  const distance = this.calculateHaversineDistance(
    currentEventGroup[0].location.latitude,
    currentEventGroup[0].location.longitude,
    nextContact.location.latitude,
    nextContact.location.longitude
  );

  if (distance <= EVENT_PROXIMITY_THRESHOLD_KM) {
    currentEventGroup.push(nextContact);
  } else {
    // Skipped due to distance
  }
}
```

---

## How the New Event Check Works

### Step-by-Step Process:

1. **Filter Contacts**
   - Only process contacts that have **both** timestamp AND valid GPS coordinates
   - Contacts without GPS data are automatically excluded (graceful handling)

2. **Sort by Time**
   - Sort remaining contacts chronologically by submission time

3. **Create Event Clusters**
   - For each contact, look for other contacts that meet **BOTH** criteria:
     - **Time Criterion**: Added within `EVENT_DETECTION_THRESHOLD_HOURS` (4 hours)
     - **GPS Criterion**: Located within `EVENT_PROXIMITY_THRESHOLD_KM` (1 km) of the first contact in the group

4. **Measure Distance**
   - Distance is calculated from the **first contact** in the event group
   - Uses Haversine formula for accurate geographic distance

5. **Track Skipped Contacts**
   - Logs how many contacts were skipped due to distance
   - Provides transparency in DEBUG mode

---

## Enhanced Metadata

Event groups now include additional location metadata:

```javascript
{
  id: "rules_event_...",
  name: "Networking Event - 12/15/2024",
  type: "rules_event",
  metadata: {
    // Existing fields
    eventDate: "2024-12-15T10:00:00.000Z",
    eventType: "rapid_networking",
    duration: 1.5,
    contactCount: 8,
    confidence: "high",

    // NEW: Location data
    locationData: {
      center: { lat: 37.7749, lng: -122.4194 },
      radius: 320  // meters - maximum distance from center
    },
    requiresGPS: true  // Flag indicating GPS was required
  }
}
```

---

## Edge Case Handling

### Contacts Without GPS Data

**Behavior:** Gracefully skipped - they won't cause errors or prevent other events from forming.

**Implementation:**
```javascript
const unassignedWithTimeAndLocation = contacts.filter(c =>
  !assignedContacts.has(c.id) &&
  (c.submittedAt || c.createdAt) &&
  c.location?.latitude &&        // Must have latitude
  c.location?.longitude &&       // Must have longitude
  !isNaN(c.location.latitude) && // Must be valid number
  !isNaN(c.location.longitude)   // Must be valid number
);
```

**Result:**
- No errors thrown for missing GPS data
- Contacts without GPS simply don't participate in event grouping
- Clear logging: "Insufficient unassigned contacts with timestamps AND GPS data"

---

## Confidence Scoring Enhancement

Confidence now considers location tightness in addition to time:

```javascript
// OLD: Only time + count
if (contactCount >= 5 && duration <= 8) {
  confidence = 'high';
}

// NEW: Time + count + GPS radius
if (contactCount >= 5 &&
    duration <= 8 &&
    maxRadius <= 500) {  // Within 500m
  confidence = 'high';
} else if (duration > 12 ||
           contactCount < 3 ||
           maxRadius > 1000) {  // Spread over 1km
  confidence = 'low';
}
```

**Confidence Levels:**
- **High**: 5+ contacts, ≤8 hours, within 500m radius
- **Medium**: Moderate spread in time or space
- **Low**: >12 hours, <3 contacts, OR >1km radius

---

## Logging Enhancements

### Standard Output:
```
📅 [Event Grouping] Processing...
   📊 Analyzing submission patterns for 150 contacts...
   📊 Found 87 contacts with both time and GPS data
   📊 Analyzing 87 contacts for event patterns (time + GPS)...

   ✅ Created "Networking Event - 12/15/2024"
      Type: rapid_networking
      Contacts: 8
      Duration: 1.5 hours
      GPS Radius: ~320m
      Confidence: high

   ⏱️  Event grouping completed in 42ms
   📦 Final count: 3 groups
   ℹ️  Skipped 12 contacts due to GPS distance > 1km
```

### Debug Mode Output:
```
   ✅ Added "John Doe" - Time: 0.5h, Distance: 250m
   ✅ Added "Jane Smith" - Time: 1.2h, Distance: 410m
   ⏭️  Skipped "Bob Johnson" - Too far (1500m > 1000m)
```

---

## Comparison: Before vs After

### Scenario: Tech Conference in San Francisco

**Test Data:**
- 20 contacts added between 9 AM - 12 PM (3 hours)
- 15 contacts at Moscone Center (GPS: 37.7749, -122.4194)
- 5 contacts added at same time but at homes in suburbs (GPS: various, 10-50km away)

#### Old Behavior (Time-Only):
```
Result: 1 group with 20 contacts
Problem: Included people who weren't at the conference
Confidence: "high" (incorrectly)
```

#### New Behavior (Time + GPS):
```
Result: 1 group with 15 contacts
✅ Correctly excluded 5 remote contacts
✅ GPS radius: ~400m (accurate for venue)
✅ Confidence: "high" (correctly)
```

---

## Impact on Other Grouping Methods

### No Changes Required For:

1. **Company Grouping** - Still works independently
2. **Time Grouping** - Still works with time-only logic (for non-event patterns)
3. **Location Grouping** - Now uses 1km threshold (increased from 500m)

### Processing Order:
```
1. Company Grouping (highest priority)
   ↓
2. Time Grouping (time-only patterns)
   ↓
3. Location Grouping (GPS-only clusters, 1km radius)
   ↓
4. Event Grouping (time + GPS, 1km radius)  ← ENHANCED
```

Contacts are only assigned to one group, so event grouping gets contacts that weren't already grouped by more specific methods.

---

## Testing Recommendations

### Test Case 1: True Event Detection
```javascript
// Setup: Conference at venue
const contacts = [
  { name: "Person 1", submittedAt: "2024-01-15T10:00:00Z", location: { lat: 37.7749, lng: -122.4194 } },
  { name: "Person 2", submittedAt: "2024-01-15T10:30:00Z", location: { lat: 37.7750, lng: -122.4195 } },
  { name: "Person 3", submittedAt: "2024-01-15T11:00:00Z", location: { lat: 37.7751, lng: -122.4193 } }
];

// Expected: 1 event group with 3 contacts
// GPS spread: < 100m (all at same venue)
```

### Test Case 2: False Positive Prevention
```javascript
// Setup: Coincidental timing, different locations
const contacts = [
  { name: "Person A", submittedAt: "2024-01-15T10:00:00Z", location: { lat: 37.7749, lng: -122.4194 } }, // SF
  { name: "Person B", submittedAt: "2024-01-15T10:30:00Z", location: { lat: 34.0522, lng: -118.2437 } }  // LA
];

// Expected: 0 event groups (too far apart despite timing)
// Distance: ~550 km >> 1 km threshold
```

### Test Case 3: Missing GPS Data
```javascript
// Setup: Mix of contacts with/without GPS
const contacts = [
  { name: "Person X", submittedAt: "2024-01-15T10:00:00Z", location: { lat: 37.7749, lng: -122.4194 } },
  { name: "Person Y", submittedAt: "2024-01-15T10:15:00Z" }, // NO GPS
  { name: "Person Z", submittedAt: "2024-01-15T10:30:00Z", location: { lat: 37.7750, lng: -122.4195 } }
];

// Expected: 1 event group with 2 contacts (X and Z)
// Person Y gracefully skipped (no error thrown)
```

---

## Configuration Tuning

If needed, you can adjust the thresholds:

```javascript
// For tighter event detection (e.g., small venues):
const EVENT_PROXIMITY_THRESHOLD_KM = 0.5; // 500m radius

// For looser event detection (e.g., large conference centers):
const EVENT_PROXIMITY_THRESHOLD_KM = 2.0; // 2km radius

// For different time windows:
const EVENT_DETECTION_THRESHOLD_HOURS = 2; // Tighter (2 hours)
const EVENT_DETECTION_THRESHOLD_HOURS = 8; // Looser (8 hours)
```

---

## Benefits

✅ **More Accurate Event Detection**
- Eliminates false positives from coincidental timing
- Ensures contacts were actually at the same physical event

✅ **Better Confidence Scoring**
- Location tightness now factors into confidence
- Users can trust "high confidence" event groups

✅ **Graceful Edge Case Handling**
- Contacts without GPS don't break the system
- Clear logging explains why contacts were excluded

✅ **Enhanced Metadata**
- Event groups now include geographic center and radius
- Useful for map visualization and verification

✅ **Backward Compatible**
- Existing groups remain unchanged
- No migration required for historical data

---

## Summary

The enhanced event grouping logic now provides **dual-factor verification** (time + GPS) for more accurate event detection, while gracefully handling edge cases like missing GPS data. The `LOCATION_CLUSTER_THRESHOLD_KM` has been increased to 1km for better general location grouping, and event detection now requires contacts to be within 1km of each other in addition to the existing 4-hour time window.
