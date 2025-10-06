# Carousel Implementation - Multi-Carousel Support

## Overview
The carousel system has been restructured to support **multiple independent carousels**, each with its own items and settings. This allows users to create different carousels for different purposes (e.g., "Featured Work", "Blog Posts", "Resources").

## Data Structure

### Grouped Carousel Items
Instead of using a separate `carousels` array (which the API doesn't support), we use the existing `carouselItems` array with a **grouping strategy**:

```javascript
// carouselItems array contains both "container" items and regular items
carouselItems: [
  // Container item - holds carousel metadata
  {
    id: "carousel_1234567890_placeholder",
    carouselId: "carousel_1234567890",
    isContainer: true,           // ✅ Marks this as a container
    title: "Featured Projects",
    enabled: true,
    style: "modern",
    order: 0
  },
  // Regular carousel items - linked by carouselId
  {
    id: "carousel_item_1",
    carouselId: "carousel_1234567890",  // ✅ Links to container
    isContainer: false,  // or undefined
    image: "https://...",
    title: "Project Alpha",
    description: "...",
    // ... other fields
    order: 0
  },
  {
    id: "carousel_item_2",
    carouselId: "carousel_1234567890",  // ✅ Same carouselId = same carousel
    image: "https://...",
    title: "Project Beta",
    // ...
    order: 1
  }
]
```

### Link Item Structure
```javascript
// Link item in links array
{
  id: "link_123",
  type: 2,  // Carousel type
  carouselId: "carousel_1234567890",  // ✅ Links to carousel container
  title: "Content Carousel",
  isActive: true
}
```

## User Flow

### 1. Creating a Carousel from Links Page

**File**: `app/dashboard/general components/ManageLinks.jsx`

When user clicks "Add Carousel":
1. Generate unique `carouselId` (e.g., `carousel_1234567890`)
2. Create link item with `type: 2` and the `carouselId`
3. Create container placeholder in `carouselItems` with:
   - `isContainer: true`
   - Same `carouselId`
   - Default title, enabled, style

```javascript
const carouselId = `carousel_${Date.now()}`;

const newCarousel = {
    id: generateRandomId(),
    title: "Content Carousel",
    isActive: true,
    type: 2,
    carouselId: carouselId
};

const newCarouselPlaceholder = {
    id: `${carouselId}_placeholder`,
    carouselId: carouselId,
    isContainer: true,
    title: 'New Carousel',
    enabled: true,
    style: 'modern',
    order: carouselItems.length
};
```

### 2. Managing Carousels in Appearance Page

**File**: `app/dashboard/(dashboard pages)/appearance/components/CarouselManager.jsx`

The CarouselManager:
1. Groups `carouselItems` by `carouselId`
2. Creates virtual "carousel" objects from grouped items
3. Displays each carousel with its container settings and items

```javascript
// Grouping logic
const carousels = useMemo(() => {
    const grouped = {};

    carouselItems.forEach(item => {
        if (item.carouselId) {
            if (!grouped[item.carouselId]) {
                // Create virtual carousel from container item
                grouped[item.carouselId] = {
                    id: item.carouselId,
                    title: item.isContainer ? item.title : 'Carousel',
                    enabled: item.isContainer ? item.enabled : true,
                    style: item.isContainer ? item.style : 'modern',
                    items: [],
                    order: item.order
                };
            }

            if (!item.isContainer) {
                // Add regular items to carousel
                grouped[item.carouselId].items.push(item);
            }
        }
    });

    return Object.values(grouped).sort((a, b) => a.order - b.order);
}, [carouselItems]);
```

### 3. Updating Carousel Data

**File**: `app/dashboard/(dashboard pages)/appearance/components/CarouselManager.jsx`

When updating a carousel, flatten the grouped structure back to `carouselItems` array:

```javascript
const handleUpdateCarousel = (carouselId, updatedData) => {
    const updatedItems = carouselItems.map(item => {
        if (item.carouselId === carouselId) {
            if (item.isContainer) {
                // Update container properties
                return { ...item, ...updatedData };
            } else if (updatedData.items) {
                // Update regular items
                const updatedItem = updatedData.items.find(i => i.id === item.id);
                return updatedItem || item;
            }
        }
        return item;
    });

    // Add new items
    if (updatedData.items) {
        updatedData.items.forEach(newItem => {
            if (!carouselItems.find(i => i.id === newItem.id)) {
                updatedItems.push({ ...newItem, carouselId });
            }
        });
    }

    updateAppearance('carouselItems', updatedItems);
};
```

### 4. Rendering on Public Profile

**File**: `app/[userId]/components/MyLinks.jsx`

When rendering carousel on public profile:
1. Find container item by `carouselId` and `isContainer: true`
2. Find all items with same `carouselId` but `isContainer: false` or undefined
3. Only render if enabled and has items

```javascript
} else if (link.type === 2) { // Carousel type
    // Find carousel container and items with this carouselId
    const containerItem = carouselItems?.find(
        i => i.carouselId === link.carouselId && i.isContainer
    );
    const linkedItems = carouselItems?.filter(
        i => i.carouselId === link.carouselId && !i.isContainer
    );

    // Only render if enabled and has items
    if (canUseCarousel && containerItem && containerItem.enabled && linkedItems?.length > 0) {
        return (
            <div key={`carousel-${link.id}`} className="w-full max-w-2xl">
                <ProfileCarousel
                    items={linkedItems}
                    style={containerItem.style || carouselStyle}
                />
            </div>
        );
    }
    return null;
}
```

## Key Features

### ✅ Multiple Independent Carousels
- Pro: 3 carousels
- Premium: 5 carousels
- Enterprise: 10 carousels

### ✅ Per-Carousel Settings
- Title
- Enabled/Disabled toggle
- Style (modern, classic, minimal)
- Independent item management

### ✅ Bi-directional Navigation
- From Links → Appearance with highlight effect
- From Appearance → Links with highlight effect
- Hash-based scrolling and highlighting

### ✅ Real-time Synchronization
- Carousel names sync between pages
- Enabled state syncs in real-time
- Items update across all views

### ✅ Item Management
- Add/edit/delete items within each carousel
- Image upload support
- Rich metadata (title, description, category, author, etc.)

## Components

### CarouselManager.jsx
- Groups `carouselItems` by `carouselId`
- Displays list of all carousels
- Handles carousel CRUD operations

### CarouselContainerCard.jsx
- Manages single carousel container
- Shows carousel settings (title, enabled, style)
- Lists carousel items
- Add/edit/delete items functionality
- Navigation to linked link item

### CarouselItemCard.jsx
- Individual carousel item editor
- Image upload
- Rich content fields
- Preview mode

### CarouselItem.jsx (in draggables)
- Link item component for carousel
- Shows linked carousel name
- Enabled/disabled indicator
- Navigation to appearance page

### MyLinks.jsx (Public Profile)
- Filters items by `carouselId`
- Renders complete carousels
- Permission checks

## API Constraints

The implementation works within existing API limitations:
- ✅ Uses existing `carouselItems` field (no new fields needed)
- ✅ Grouping via `carouselId` field
- ✅ Container items marked with `isContainer: true`
- ✅ All updates use `AppearanceService.updateAppearanceData({ carouselItems: [...] })`

## Testing Flow

1. **Create Carousel from Links**:
   - Go to Links page
   - Click "Add Carousel" button
   - Verify carousel link is created
   - Click "Customize Carousel"
   - Should navigate to Appearance page with highlight

2. **Manage Carousel in Appearance**:
   - Verify carousel appears in Appearance page
   - Edit carousel title
   - Toggle enabled/disabled
   - Add items to carousel
   - Edit item details and upload images

3. **View on Public Profile**:
   - Visit public profile
   - Verify carousel renders at correct position
   - Verify all items display correctly
   - Verify carousel style is applied

4. **Multiple Carousels**:
   - Create multiple carousels
   - Verify each has independent settings
   - Verify each displays separately on profile

## Files Modified

- `app/dashboard/general components/ManageLinks.jsx` - Carousel creation
- `app/dashboard/(dashboard pages)/appearance/components/CarouselManager.jsx` - Grouping logic
- `app/dashboard/(dashboard pages)/appearance/elements/CarouselContainerCard.jsx` - NEW
- `app/dashboard/(dashboard pages)/appearance/elements/CarouselItemCard.jsx` - Existing
- `app/dashboard/general elements/draggables/CarouselItem.jsx` - Updated for grouped structure
- `app/[userId]/components/MyLinks.jsx` - Public rendering with filtering
- `app/dashboard/(dashboard pages)/appearance/page.jsx` - Detection logic
- `app/[userId]/House.jsx` - Removed unused `carousels` field
