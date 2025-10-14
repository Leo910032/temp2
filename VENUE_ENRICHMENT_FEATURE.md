# Venue Enrichment Feature - Technical Documentation

## Overview

The Venue Enrichment feature automatically identifies and labels location and event groups with specific venue names using the Google Maps Places Nearby Search API. This transforms generic group names like "Event on Oct 14 at 2:30 PM" into contextual names like "World Trade Center Grenoble Event".

## Architecture

This feature follows the existing Places API architecture pattern established for autocomplete and details endpoints.

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Client Layer (Optional)                    │
│  VenueEnrichmentService.js - Client-side enrichment helpers  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  /api/user/contacts/groups/enrich-venue/route.js            │
│  - Authentication & session management                       │
│  - Budget pre-flight checks                                  │
│  - Cost tracking integration                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
│  PlacesService.searchNearbyVenues()                         │
│  - Google Maps Nearby Search API calls                      │
│  - Tiered keyword search logic                              │
│  - Distance calculations (Haversine)                         │
│  - Cost tracking                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Group Generation Integration                   │
│  RulesGroupService.enrichGroupsWithVenues()                 │
│  - Automatic enrichment during group generation              │
│  - Centroid calculation from contact GPS data                │
│  - In-place group name updates                               │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### Step 1: Group Creation
During the normal rules-based group generation process, location and event groups are created based on GPS proximity and time clustering.

### Step 2: Eligibility Check
After groups are created but **before deduplication**, the system identifies eligible groups:

- **Type**: Must be `rules_location` or `rules_event`
- **Size**: Must have 5+ contacts (`VENUE_ENRICHMENT_MIN_CONTACTS`)
- **Not Enriched**: Must not already have venue data

### Step 3: Centroid Calculation
For each eligible group, calculate the geographic center point:

```javascript
centroid = {
  lat: average(all contact latitudes),
  lng: average(all contact longitudes)
}
```

Only contacts with valid GPS coordinates (`latitude`, `longitude` are numbers) are included.

### Step 4: Tiered Keyword Search

The system performs a **prioritized, multi-tier search** using Google Maps Nearby Search API:

#### Tier 1 (Highest Priority - Major Venues)
- `conference center`
- `convention center`
- `exhibition hall`
- `arena`
- `stadium`
- `university`
- `tech park`

#### Tier 2 (Business & Networking Venues)
- `hotel`
- `coworking space`
- `business center`
- `auditorium`

#### Tier 3 (Optional - Social Venues)
- `restaurant`
- `bar`
- `cafe`

**Search Strategy**: The system tries each keyword in order. The **first keyword that returns results** is used, and the search stops immediately.

### Step 5: Venue Selection

When results are found:
1. Calculate distance from each venue to the group's centroid using the **Haversine formula**
2. Select the **closest venue** as the best match

### Step 6: Group Enrichment

If a venue is found, the group is enriched **in-place**:

**Before**:
```javascript
{
  name: "Event on Oct 14 at 2:30 PM",
  type: "rules_event",
  contactIds: [...],
  metadata: {
    confidence: "high",
    // ...
  }
}
```

**After**:
```javascript
{
  name: "World Trade Center Grenoble Event",
  type: "rules_event",
  contactIds: [...],
  metadata: {
    confidence: "high",
    venue: {
      name: "World Trade Center Grenoble",
      address: "5-7 Place Robert Schuman, Grenoble",
      placeId: "ChIJ...",
      location: { lat: 45.1885, lng: 5.7245 },
      types: ["point_of_interest", "establishment"],
      distance: 0.15, // km from centroid
      matchedKeyword: "conference center"
    },
    enriched: true,
    enrichedAt: "2025-10-14T15:30:00.000Z",
    centroid: { lat: 45.1888, lng: 5.7248 },
    averageTimestamp: "2025-10-14T15:20:00.000Z"
  }
}
```

### Step 7: Fallback Behavior

If **no venue is found** after trying all keywords:
- Group name remains generic (e.g., "Event near Rue de la République")
- No metadata is added
- Group continues through normal processing

## API Endpoint

### POST `/api/user/contacts/groups/enrich-venue`

**Request Body**:
```json
{
  "latitude": 45.1885,
  "longitude": 5.7245,
  "radius": 1000,
  "keywords": ["conference center", "hotel", "university"],
  "sessionId": "session_12345_abc" // optional
}
```

**Success Response** (200):
```json
{
  "success": true,
  "venue": {
    "name": "World Trade Center Grenoble",
    "address": "5-7 Place Robert Schuman, Grenoble",
    "placeId": "ChIJ...",
    "location": { "lat": 45.1885, "lng": 5.7245 },
    "types": ["point_of_interest", "establishment"],
    "distance": 0.15,
    "matchedKeyword": "conference center"
  },
  "totalResults": 8
}
```

**No Results Response** (200):
```json
{
  "success": false,
  "venue": null,
  "message": "No venues found in the area"
}
```

**Budget Exceeded** (402):
```json
{
  "success": false,
  "error": "Monthly API limit reached",
  "reason": "api_runs_exceeded",
  "budget": { ... },
  "upgradeRequired": true
}
```

## Cost Tracking

### API Costs
- **Google Maps Nearby Search**: $0.032 per request ($32 per 1,000 requests)
- Defined in `lib/services/constants/apiCosts.js`

### Cost Management
- **Pre-flight budget check** before each API call
- Tracks usage via `CostTrackingService.recordUsage()`
- Usage type: `ApiUsage`
- Feature: `google_maps_nearby_search`
- Billable: Yes (`isBillableRun: true`)
- Provider: `google_maps`

### Budget Limits
Controlled by user subscription level via `SessionManager.canAffordOperation()`.

## Configuration

### Constants (`rulesGroupService.js`)

```javascript
// Venue Enrichment
const VENUE_ENRICHMENT_MIN_CONTACTS = 5;    // Minimum contacts to trigger enrichment
const VENUE_SEARCH_RADIUS_M = 1000;         // 1km search radius

// Existing constants used
const EVENT_PROXIMITY_THRESHOLD_KM = 1.0;   // GPS proximity for event grouping
const LOCATION_CLUSTER_THRESHOLD_KM = 1.0;  // Location clustering radius
```

### Disabling Venue Enrichment

Pass `enrichWithVenues: false` in options:

```javascript
await RulesGroupService.generateRulesBasedGroups(userId, {
  minGroupSize: 2,
  maxGroups: 15,
  enrichWithVenues: false  // Disable venue enrichment
});
```

## Example Workflow

### Scenario
User scans 8 business cards at a tech conference in Grenoble.

1. **Contacts Created**:
   - All have GPS coordinates near World Trade Center Grenoble
   - All have timestamps within 4 hours
   - All added on Oct 14, 2025 around 3:00 PM

2. **Event Group Created**:
   ```
   Name: "Event on Oct 14 at 3:15 PM"
   Type: rules_event
   Contacts: 8
   ```

3. **Eligibility Check**: ✅ Passes
   - Is event group ✓
   - Has 8 contacts (≥ 5) ✓
   - Not enriched ✓

4. **Centroid Calculated**:
   ```
   lat: 45.1888 (average of 8 contact latitudes)
   lng: 5.7248 (average of 8 contact longitudes)
   ```

5. **API Search - Tier 1**:
   - Tries keyword: "conference center"
   - Google API returns 8 results
   - **STOP** - Results found!

6. **Venue Selection**:
   - Calculates distances to all 8 venues
   - Closest: "World Trade Center Grenoble" (150m from centroid)

7. **Group Enriched**:
   ```
   Name: "World Trade Center Grenoble Event"
   Metadata: {
     venue: { ... },
     enriched: true,
     centroid: { lat: 45.1888, lng: 5.7248 }
   }
   ```

8. **Processing Continues**:
   - Group goes through deduplication
   - Weighted scoring for selection
   - Saved to database with enriched name

## Files Modified/Created

### New Files
1. **`app/api/user/contacts/groups/enrich-venue/route.js`**
   - API endpoint for venue enrichment
   - Budget checks and authentication

2. **`lib/services/serviceContact/client/services/VenueEnrichmentService.js`**
   - Client-side service (optional, for manual enrichment)
   - Helper methods for centroid calculation

3. **`VENUE_ENRICHMENT_FEATURE.md`** (this file)
   - Comprehensive documentation

### Modified Files
1. **`lib/services/constants/apiCosts.js`**
   - Added `PLACES_NEARBY_SEARCH` cost constants

2. **`lib/services/serviceContact/server/GroupService/placesService.js`**
   - Added `searchNearbyVenues()` method
   - Added `_findClosestVenue()` helper
   - Added `_calculateHaversineDistance()` helper
   - Added `_toRadians()` helper

3. **`lib/services/serviceContact/server/GroupService/rulesGroupService.js`**
   - Added venue enrichment constants
   - Added PlacesService import
   - Added enrichment step in `generateRulesBasedGroups()`
   - Added `enrichGroupsWithVenues()` method
   - Added `_calculateCentroid()` helper
   - Added `_calculateAverageTimestamp()` helper
   - Added `_cleanVenueName()` helper

## Testing Recommendations

### Manual Testing
1. **Generate test contacts** with GPS coordinates near a known venue
2. **Trigger group generation** via the UI
3. **Verify enrichment** in console logs and database
4. **Check cost tracking** in Firebase

### Test Cases

#### Test 1: Successful Enrichment
- **Setup**: 6 contacts near "Palais des Congrès Paris"
- **Expected**: Group named "Palais des Congrès Event"
- **Verify**: Metadata contains venue details

#### Test 2: No Venue Found
- **Setup**: 6 contacts in rural area with no venues
- **Expected**: Generic name kept
- **Verify**: No enrichment metadata added

#### Test 3: Insufficient Contacts
- **Setup**: 4 contacts near a venue (< 5 minimum)
- **Expected**: Enrichment skipped
- **Verify**: Console logs show skip reason

#### Test 4: Budget Exceeded
- **Setup**: User at API limit
- **Expected**: Enrichment fails gracefully
- **Verify**: Groups still created with generic names

#### Test 5: Mixed Groups
- **Setup**: Company groups + Event groups
- **Expected**: Only event groups enriched
- **Verify**: Company groups unchanged

### Console Output Example

```
📦 Total groups before enrichment: 4

🏢 [Venue Enrichment] Searching for venues...
   🔍 Analyzing 4 groups for venue enrichment eligibility...
   ✅ Found 1 eligible groups for venue enrichment

   🔍 Searching venues for: Event on Oct 14 at 3:15 PM
      Centroid: 45.188800, 5.724800
      Contacts: 8
      ✅ Enriched as: "World Trade Center Grenoble Event" (venue: World Trade Center Grenoble, 150m away)

   ✅ Enriched 1 groups with venue data
   ⏭️  Skipped 3 groups (not eligible or no venue found)
```

## Performance Considerations

### API Call Limits
- **Maximum**: 1 API call per eligible group
- **Early termination**: Stops at first successful keyword
- **Async processing**: Each group processed sequentially to avoid rate limits

### Budget Impact
- **Cost per enrichment**: $0.032 (single search)
- **Tier 1 success rate**: Estimated 70-80% for conference/event venues
- **Tier 2 fallback**: Estimated 15-20% additional coverage
- **Tier 3**: Currently disabled for cost optimization

### Optimization Strategies
1. **Increase minimum contacts** if budget is tight
2. **Disable Tier 3** keywords (currently done)
3. **Use `enrichWithVenues: false`** for low-value groups
4. **Batch processing**: Already implemented (sequential enrichment)

## Future Enhancements

### Potential Improvements
1. **Caching**: Store venue lookups by centroid hash
2. **User preferences**: Allow users to customize keyword tiers
3. **Confidence scoring**: Rate venue matches by distance/type
4. **Manual override**: UI to manually select venue from results
5. **Venue aliases**: Handle venue name variations
6. **Type filtering**: Prefer certain venue types based on group type

## Troubleshooting

### Issue: No venues found for obvious locations
- **Check**: GPS coordinate accuracy
- **Check**: Search radius (increase if needed)
- **Solution**: Add more keywords to tiers

### Issue: Wrong venue selected
- **Cause**: Multiple venues at similar distance
- **Solution**: Implement confidence scoring based on venue types

### Issue: Budget exceeded errors
- **Check**: User subscription level via Firebase
- **Solution**: Increase API budget or reduce enrichment frequency

### Issue: Groups not being enriched
- **Check**: Group has 5+ contacts
- **Check**: Group type is `rules_location` or `rules_event`
- **Check**: Contacts have valid GPS data
- **Enable**: `DEBUG_GROUPS=true` for detailed logs

## Related Documentation

- [RULES_GROUPING_FIXES.md](./RULES_GROUPING_FIXES.md) - Core grouping logic
- [EVENT_GROUPING_ENHANCEMENT.md](./EVENT_GROUPING_ENHANCEMENT.md) - GPS proximity for events
- [Google Maps Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) - Official API costs

## Summary

The Venue Enrichment feature provides **contextual, meaningful names** for location and event groups by automatically identifying venues using Google Maps. It integrates seamlessly into the existing group generation pipeline with:

✅ **Automatic enrichment** during group creation
✅ **Smart tiered search** with fallback keywords
✅ **Cost tracking** and budget management
✅ **Graceful degradation** if no venue found
✅ **Zero client-side changes** required (server-side only)

This transforms generic group names into actionable, memorable labels that enhance the user experience.
