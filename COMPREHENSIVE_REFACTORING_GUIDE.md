# Comprehensive Refactoring Guide

## Overview

This guide provides best practices, patterns, and strategies for refactoring code in this Next.js application. Use this as a reference when modernizing, optimizing, or restructuring any part of the codebase.

## Table of Contents

1. [General Refactoring Principles](#general-refactoring-principles)
2. [Code Organization](#code-organization)
3. [Component Refactoring](#component-refactoring)
4. [Service Layer Refactoring](#service-layer-refactoring)
5. [API Routes Refactoring](#api-routes-refactoring)
6. [State Management](#state-management)
7. [Performance Optimization](#performance-optimization)
8. [Security Improvements](#security-improvements)
9. [Testing Strategy](#testing-strategy)
10. [Migration Checklist](#migration-checklist)

---

## General Refactoring Principles

### The Golden Rules

1. **Make it work, then make it right, then make it fast**
   - First ensure functionality is correct
   - Then improve code quality
   - Finally optimize performance if needed

2. **Refactor in small, incremental steps**
   - Each step should be testable
   - Commit frequently with clear messages
   - Never break existing functionality

3. **Test before and after**
   - Ensure tests pass before refactoring
   - Add tests if they don't exist
   - Verify tests still pass after changes

4. **One refactoring at a time**
   - Don't mix refactoring with new features
   - Don't refactor multiple concerns simultaneously
   - Keep changes focused and reviewable

### When to Refactor

**DO refactor when:**
- Code is duplicated in multiple places
- Functions exceed 50-100 lines
- Components have too many responsibilities
- Logic is deeply nested (>3 levels)
- Code is difficult to test
- Adding new features is increasingly difficult
- Performance issues are identified

**DON'T refactor when:**
- Deadline is imminent (plan for later)
- Code works and won't be modified soon
- Changes don't add clear value
- System behavior is not well understood

---

## Code Organization

### Current Structure
```
project/
├── app/                    # Next.js 13+ App Router
├── lib/                    # Core business logic
│   ├── authentication/     # Auth services
│   ├── services/          # Feature services
│   └── constants/         # Shared constants
├── LocalHooks/            # Custom React hooks
├── utils/                 # Utility functions
└── public/               # Static assets
```

### Recommended Structure Improvements

#### 1. Group by Feature (Domain-Driven Design)

**Before:**
```
lib/
├── services/
│   ├── serviceAdmin/
│   ├── serviceContact/
│   └── serviceEnterprise/
```

**After (Recommended for new features):**
```
lib/
├── features/
│   ├── admin/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types.ts
│   │   └── index.ts
│   ├── contacts/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts
│   └── analytics/
│       └── ...
```

#### 2. Separate Client and Server Code

**Rule:** Keep client and server code clearly separated

```javascript
// ❌ BAD - Mixed concerns
lib/services/contactService.js  // Contains both client & server code

// ✅ GOOD - Clear separation
lib/services/contacts/
├── client/
│   └── contactClient.js       // Client-side only
└── server/
    └── contactServer.js       // Server-side only
```

#### 3. Extract Constants

**Before:**
```javascript
// Scattered throughout code
const MAX_RETRIES = 3;
const TIMEOUT = 5000;
```

**After:**
```javascript
// lib/constants/config.js
export const API_CONFIG = {
  MAX_RETRIES: 3,
  TIMEOUT: 5000,
  RATE_LIMIT: 100,
};

// lib/constants/routes.js
export const ROUTES = {
  DASHBOARD: '/dashboard',
  CONTACTS: '/dashboard/contacts',
  ADMIN: '/admin',
};
```

---

## Component Refactoring

### 1. Single Responsibility Principle

**Before:**
```jsx
// ❌ Component does too much
export default function ContactCard({ contact }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(contact);

  const handleSave = async () => {
    const response = await fetch('/api/contacts', {
      method: 'PUT',
      body: JSON.stringify(formData),
    });
    // ... validation, error handling, notifications
  };

  return (
    <div>
      {isEditing ? (
        <form>
          {/* 100+ lines of form fields */}
        </form>
      ) : (
        <div>
          {/* 50+ lines of display logic */}
        </div>
      )}
    </div>
  );
}
```

**After:**
```jsx
// ✅ Separated concerns
export default function ContactCard({ contact }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      {isEditing ? (
        <ContactEditForm
          contact={contact}
          onSave={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <ContactDisplay
          contact={contact}
          onEdit={() => setIsEditing(true)}
        />
      )}
    </div>
  );
}
```

### 2. Extract Custom Hooks

**Before:**
```jsx
// ❌ Logic mixed in component
export default function ContactList() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/contacts');
        const data = await response.json();
        setContacts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  // ... more logic
}
```

**After:**
```jsx
// ✅ Extracted into custom hook
// LocalHooks/useContacts.js
export function useContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/contacts');
      const data = await response.json();
      setContacts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { contacts, loading, error, refetch: fetchContacts };
}

// Component
export default function ContactList() {
  const { contacts, loading, error } = useContacts();

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  return <div>{/* Render contacts */}</div>;
}
```

### 3. Composition Over Props Drilling

**Before:**
```jsx
// ❌ Props drilling
<Dashboard user={user} theme={theme} locale={locale}>
  <Sidebar user={user} theme={theme}>
    <Menu user={user} theme={theme}>
      <MenuItem user={user} theme={theme} />
    </Menu>
  </Sidebar>
</Dashboard>
```

**After:**
```jsx
// ✅ Context API
// contexts/AppContext.jsx
export const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');

  return (
    <AppContext.Provider value={{ user, theme }}>
      {children}
    </AppContext.Provider>
  );
}

// Component
export default function MenuItem() {
  const { user, theme } = useContext(AppContext);
  // Use directly without drilling
}
```

### 4. Component Patterns

#### Compound Components Pattern
```jsx
// ✅ Flexible and composable
export function Card({ children, className }) {
  return <div className={`card ${className}`}>{children}</div>;
}

Card.Header = function CardHeader({ children }) {
  return <div className="card-header">{children}</div>;
};

Card.Body = function CardBody({ children }) {
  return <div className="card-body">{children}</div>;
};

Card.Footer = function CardFooter({ children }) {
  return <div className="card-footer">{children}</div>;
};

// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

#### Render Props Pattern
```jsx
// ✅ Share logic without hooks
export function DataProvider({ url, render }) {
  const [data, loading, error] = useFetch(url);
  return render({ data, loading, error });
}

// Usage
<DataProvider
  url="/api/contacts"
  render={({ data, loading }) => (
    loading ? <Loader /> : <ContactList contacts={data} />
  )}
/>
```

---

## Service Layer Refactoring

### 1. Service Class Pattern

**Before:**
```javascript
// ❌ Scattered functions
export async function getContact(id) { ... }
export async function updateContact(id, data) { ... }
export async function deleteContact(id) { ... }
```

**After:**
```javascript
// ✅ Organized service class
export class ContactService {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '/api/contacts';
  }

  async getById(id) {
    const response = await fetch(`${this.baseUrl}/${id}`);
    return this.handleResponse(response);
  }

  async update(id, data) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async delete(id) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    return this.handleResponse(response);
  }

  async handleResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}

// Usage
const contactService = new ContactService();
const contact = await contactService.getById(123);
```

### 2. Repository Pattern

**Separation of concerns: data access logic separate from business logic**

```javascript
// lib/repositories/contactRepository.js
import { db } from '@/lib/firebase';

export class ContactRepository {
  constructor() {
    this.collection = 'contacts';
  }

  async findById(userId, contactId) {
    const docRef = db.collection(this.collection)
      .doc(userId)
      .collection('items')
      .doc(contactId);

    const doc = await docRef.get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findAll(userId, filters = {}) {
    let query = db.collection(this.collection)
      .doc(userId)
      .collection('items');

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async create(userId, data) {
    const docRef = await db.collection(this.collection)
      .doc(userId)
      .collection('items')
      .add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return docRef.id;
  }

  async update(userId, contactId, data) {
    await db.collection(this.collection)
      .doc(userId)
      .collection('items')
      .doc(contactId)
      .update({
        ...data,
        updatedAt: new Date(),
      });
  }

  async delete(userId, contactId) {
    await db.collection(this.collection)
      .doc(userId)
      .collection('items')
      .doc(contactId)
      .delete();
  }
}
```

### 3. Error Handling Strategy

**Create custom error classes:**

```javascript
// lib/errors/AppError.js
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized access', 401);
  }
}

// Usage in services
import { NotFoundError, ValidationError } from '@/lib/errors/AppError';

export class ContactService {
  async getById(userId, contactId) {
    const contact = await this.repository.findById(userId, contactId);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    return contact;
  }

  async create(userId, data) {
    if (!data.name || !data.email) {
      throw new ValidationError('Name and email are required');
    }

    return this.repository.create(userId, data);
  }
}
```

---

## API Routes Refactoring

### 1. Middleware Pattern

**Before:**
```javascript
// ❌ Repeated authentication logic
export async function POST(request) {
  // Check authentication
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Business logic
  const data = await request.json();
  // ... process data
}
```

**After:**
```javascript
// lib/middleware/auth.js
export function withAuth(handler) {
  return async (request, context) => {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Add user to context
    context.user = session.user;
    return handler(request, context);
  };
}

// app/api/contacts/route.js
import { withAuth } from '@/lib/middleware/auth';

async function handlePOST(request, { user }) {
  const data = await request.json();
  // ... process data with user context
}

export const POST = withAuth(handlePOST);
```

### 2. Validation Layer

**Using Zod for validation:**

```javascript
// lib/validations/contactSchema.js
import { z } from 'zod';

export const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const updateContactSchema = createContactSchema.partial();

// lib/middleware/validation.js
export function withValidation(schema) {
  return (handler) => {
    return async (request, context) => {
      try {
        const body = await request.json();
        const validatedData = schema.parse(body);
        context.validatedData = validatedData;
        return handler(request, context);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation failed', details: error.errors },
            { status: 400 }
          );
        }
        throw error;
      }
    };
  };
}

// Usage
import { withAuth } from '@/lib/middleware/auth';
import { withValidation } from '@/lib/middleware/validation';
import { createContactSchema } from '@/lib/validations/contactSchema';

async function handlePOST(request, { user, validatedData }) {
  // validatedData is already validated and typed
  const contact = await contactService.create(user.id, validatedData);
  return NextResponse.json(contact);
}

export const POST = withAuth(withValidation(createContactSchema)(handlePOST));
```

### 3. Response Standardization

```javascript
// lib/utils/apiResponse.js
export class ApiResponse {
  static success(data, message = 'Success', meta = {}) {
    return NextResponse.json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static error(message, statusCode = 500, errors = []) {
    return NextResponse.json(
      {
        success: false,
        message,
        errors,
      },
      { status: statusCode }
    );
  }

  static created(data, message = 'Created successfully') {
    return NextResponse.json(
      {
        success: true,
        message,
        data,
      },
      { status: 201 }
    );
  }
}

// Usage
export async function POST(request) {
  try {
    const contact = await contactService.create(data);
    return ApiResponse.created(contact);
  } catch (error) {
    return ApiResponse.error(error.message, error.statusCode);
  }
}
```

---

## State Management

### 1. Local State Management

**Use appropriate hooks:**

```javascript
// ✅ Simple state
const [count, setCount] = useState(0);

// ✅ Complex state with actions
const [state, dispatch] = useReducer(reducer, initialState);

// ✅ Derived state
const filteredItems = useMemo(() => {
  return items.filter(item => item.status === filter);
}, [items, filter]);

// ✅ Expensive computations
const total = useMemo(() => {
  return items.reduce((sum, item) => sum + item.price, 0);
}, [items]);
```

### 2. Global State Management

**Context + useReducer pattern:**

```javascript
// contexts/ContactsContext.jsx
const ContactsContext = createContext();

function contactsReducer(state, action) {
  switch (action.type) {
    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload, loading: false };
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };
    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map(c =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case 'DELETE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.filter(c => c.id !== action.payload),
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

export function ContactsProvider({ children }) {
  const [state, dispatch] = useReducer(contactsReducer, {
    contacts: [],
    loading: true,
    error: null,
  });

  const actions = useMemo(() => ({
    setContacts: (contacts) => dispatch({ type: 'SET_CONTACTS', payload: contacts }),
    addContact: (contact) => dispatch({ type: 'ADD_CONTACT', payload: contact }),
    updateContact: (contact) => dispatch({ type: 'UPDATE_CONTACT', payload: contact }),
    deleteContact: (id) => dispatch({ type: 'DELETE_CONTACT', payload: id }),
    setLoading: (loading) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
  }), []);

  return (
    <ContactsContext.Provider value={{ state, actions }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within ContactsProvider');
  }
  return context;
}
```

---

## Performance Optimization

### 1. Component Optimization

```javascript
// ✅ Memoize expensive components
export const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  // Expensive rendering logic
  return <div>{/* ... */}</div>;
});

// ✅ Memoize callbacks
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);

// ✅ Avoid inline objects/arrays in props
// ❌ BAD
<Component style={{ margin: 10 }} items={[1, 2, 3]} />

// ✅ GOOD
const style = { margin: 10 };
const items = [1, 2, 3];
<Component style={style} items={items} />
```

### 2. Code Splitting

```javascript
// ✅ Dynamic imports for large components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <Loader />,
  ssr: false,
});

// ✅ Route-based code splitting (automatic in Next.js)
// Each page in app/ directory is automatically code-split
```

### 3. Database Query Optimization

```javascript
// ❌ BAD - N+1 query problem
async function getContactsWithDetails(userId) {
  const contacts = await getContacts(userId);

  for (const contact of contacts) {
    contact.events = await getEvents(contact.id);  // N queries!
  }

  return contacts;
}

// ✅ GOOD - Batch queries
async function getContactsWithDetails(userId) {
  const contacts = await getContacts(userId);
  const contactIds = contacts.map(c => c.id);

  // Single query for all events
  const allEvents = await getEventsByContactIds(contactIds);

  // Group events by contact
  const eventsByContact = allEvents.reduce((acc, event) => {
    if (!acc[event.contactId]) acc[event.contactId] = [];
    acc[event.contactId].push(event);
    return acc;
  }, {});

  // Attach events to contacts
  return contacts.map(contact => ({
    ...contact,
    events: eventsByContact[contact.id] || [],
  }));
}
```

---

## Security Improvements

### 1. Input Sanitization

```javascript
import sanitizeHtml from 'sanitize-html';

// ✅ Sanitize user input
export function sanitizeUserInput(input) {
  return sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a'],
    allowedAttributes: {
      'a': ['href']
    },
  });
}

// Usage in API route
export async function POST(request) {
  const { name, description } = await request.json();

  const sanitizedData = {
    name: sanitizeUserInput(name),
    description: sanitizeUserInput(description),
  };

  // ... save sanitizedData
}
```

### 2. Rate Limiting

```javascript
// lib/middleware/rateLimit.js
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

export function withRateLimit(handler) {
  return async (request, context) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    try {
      await rateLimiter.consume(ip);
      return handler(request, context);
    } catch (error) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
  };
}
```

### 3. Authorization Checks

```javascript
// lib/middleware/authorize.js
export function withAuthorization(requiredRole) {
  return (handler) => {
    return async (request, context) => {
      const { user } = context;

      if (!user || user.role !== requiredRole) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      return handler(request, context);
    };
  };
}

// Usage
export const DELETE = withAuth(
  withAuthorization('admin')(handleDELETE)
);
```

---

## Testing Strategy

### 1. Unit Tests

```javascript
// __tests__/lib/services/ContactService.test.js
import { ContactService } from '@/lib/services/ContactService';

describe('ContactService', () => {
  let service;
  let mockRepository;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    service = new ContactService(mockRepository);
  });

  describe('getById', () => {
    it('should return contact when found', async () => {
      const mockContact = { id: '123', name: 'John' };
      mockRepository.findById.mockResolvedValue(mockContact);

      const result = await service.getById('user1', '123');

      expect(result).toEqual(mockContact);
      expect(mockRepository.findById).toHaveBeenCalledWith('user1', '123');
    });

    it('should throw NotFoundError when contact does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getById('user1', '999'))
        .rejects
        .toThrow('Contact not found');
    });
  });
});
```

### 2. Integration Tests

```javascript
// __tests__/api/contacts.test.js
import { POST } from '@/app/api/contacts/route';

describe('POST /api/contacts', () => {
  it('should create a contact', async () => {
    const mockRequest = {
      json: async () => ({
        name: 'John Doe',
        email: 'john@example.com',
      }),
    };

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
  });

  it('should return 400 for invalid data', async () => {
    const mockRequest = {
      json: async () => ({
        name: '',  // Invalid
        email: 'invalid-email',  // Invalid
      }),
    };

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
  });
});
```

---

## Migration Checklist

### Before Starting

- [ ] Review current code and identify pain points
- [ ] Document current behavior (write tests if needed)
- [ ] Create a feature branch
- [ ] Communicate changes to team
- [ ] Ensure tests pass on main branch

### During Refactoring

- [ ] Make small, incremental changes
- [ ] Test after each change
- [ ] Commit frequently with descriptive messages
- [ ] Update documentation as you go
- [ ] Add/update tests for refactored code

### After Refactoring

- [ ] All tests pass
- [ ] No functionality has been broken
- [ ] Code coverage maintained or improved
- [ ] Performance benchmarks met or improved
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Merge to main branch

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Address any issues promptly

---

## Common Refactoring Patterns

### 1. Extract Method

**Before:**
```javascript
function processOrder(order) {
  // Validate
  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have items');
  }

  // Calculate total
  let total = 0;
  for (const item of order.items) {
    total += item.price * item.quantity;
  }

  // Apply discount
  if (order.discountCode) {
    const discount = getDiscount(order.discountCode);
    total = total * (1 - discount);
  }

  return total;
}
```

**After:**
```javascript
function processOrder(order) {
  validateOrder(order);
  const subtotal = calculateSubtotal(order.items);
  const total = applyDiscount(subtotal, order.discountCode);
  return total;
}

function validateOrder(order) {
  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have items');
  }
}

function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function applyDiscount(total, discountCode) {
  if (!discountCode) return total;
  const discount = getDiscount(discountCode);
  return total * (1 - discount);
}
```

### 2. Replace Conditional with Polymorphism

**Before:**
```javascript
function calculateShipping(order) {
  if (order.shippingType === 'standard') {
    return order.weight * 0.5;
  } else if (order.shippingType === 'express') {
    return order.weight * 1.5 + 10;
  } else if (order.shippingType === 'overnight') {
    return order.weight * 3 + 25;
  }
}
```

**After:**
```javascript
class ShippingCalculator {
  calculate(order) {
    throw new Error('Must implement calculate method');
  }
}

class StandardShipping extends ShippingCalculator {
  calculate(order) {
    return order.weight * 0.5;
  }
}

class ExpressShipping extends ShippingCalculator {
  calculate(order) {
    return order.weight * 1.5 + 10;
  }
}

class OvernightShipping extends ShippingCalculator {
  calculate(order) {
    return order.weight * 3 + 25;
  }
}

const shippingCalculators = {
  standard: new StandardShipping(),
  express: new ExpressShipping(),
  overnight: new OvernightShipping(),
};

function calculateShipping(order) {
  const calculator = shippingCalculators[order.shippingType];
  return calculator.calculate(order);
}
```

### 3. Introduce Parameter Object

**Before:**
```javascript
function createUser(firstName, lastName, email, phone, address, city, country) {
  // Too many parameters!
}
```

**After:**
```javascript
function createUser(userDetails) {
  const { firstName, lastName, email, phone, address, city, country } = userDetails;
  // Better!
}

// Usage
createUser({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '123-456-7890',
  address: '123 Main St',
  city: 'New York',
  country: 'USA',
});
```

---

## Best Practices Summary

### DO's

- Write tests before refactoring
- Keep changes small and focused
- Use meaningful variable and function names
- Extract reusable logic into utilities
- Document complex logic
- Use TypeScript for better type safety
- Follow consistent coding style
- Review your own code before requesting review

### DON'Ts

- Don't refactor without tests
- Don't mix refactoring with new features
- Don't optimize prematurely
- Don't over-engineer simple solutions
- Don't ignore error handling
- Don't forget to update documentation
- Don't rush - take time to do it right

---

## Additional Resources

- [Clean Code by Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Refactoring by Martin Fowler](https://refactoring.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Best Practices](https://react.dev/learn)
- Project-specific guides:
  - [COST_TRACKING_MIGRATION_GUIDE.md](COST_TRACKING_MIGRATION_GUIDE.md)
  - [ADMIN_REFACTOR_SUMMARY.md](ADMIN_REFACTOR_SUMMARY.md)
  - [ADMIN_SERVICE_SEPARATION_GUIDE.md](ADMIN_SERVICE_SEPARATION_GUIDE.md)

---

## Questions or Issues?

If you encounter issues while refactoring or need clarification:

1. Check existing documentation in the repository
2. Review similar implementations in the codebase
3. Discuss with the team before making major architectural changes
4. Update this guide if you discover better patterns

**Remember:** The goal of refactoring is to make the code more maintainable, not just different.
