# Dynamic Time Slots API Documentation

## Overview
This system allows admins to create dynamic time slot configurations with customizable start time, end time, break time, and duration. The system automatically generates time slots based on these parameters.

## Features
- ✅ Admin can create time slot configurations
- ✅ Automatic time slot generation based on parameters
- ✅ Optional break time support
- ✅ Dynamic appointment booking with validation
- ✅ Multiple time slot configurations support
- ✅ Active/inactive status management

## API Endpoints

### Time Slot Management

#### 1. Create Time Slot Configuration
```
POST /api/v1/timeslot
```

**Request Body:**
```json
{
  "startTime": "09:00",
  "endTime": "17:00",
  "breakTime": "12:00",  // Optional
  "duration": 60         // Duration in minutes
}
```

**Response:**
```json
{
  "statusCode": 201,
  "message": "Time slot created successfully",
  "data": {
    "_id": "timeslot_id",
    "startTime": "09:00",
    "endTime": "17:00",
    "breakTime": "12:00",
    "duration": 60,
    "isActive": true,
    "generatedSlots": [
      {
        "slotId": "slot_1",
        "startTime": "09:00",
        "endTime": "10:00",
        "isBreak": false
      },
      {
        "slotId": "slot_2",
        "startTime": "10:00",
        "endTime": "11:00",
        "isBreak": false
      },
      {
        "slotId": "break_2",
        "startTime": "12:00",
        "endTime": "13:00",
        "isBreak": true
      }
    ]
  }
}
```

#### 2. Get All Time Slot Configurations
```
GET /api/v1/timeslot?isActive=true
```

#### 3. Get Time Slot by ID
```
GET /api/v1/timeslot/:id
```

#### 4. Update Time Slot Configuration
```
PUT /api/v1/timeslot/:id
```

#### 5. Delete Time Slot Configuration
```
DELETE /api/v1/timeslot/:id
```

#### 6. Get Generated Slots for a Time Slot
```
GET /api/v1/timeslot/:id/slots?excludeBreaks=true
```

### Appointment Management

#### 1. Get Available Time Slots for a Date
```
GET /api/v1/appointment/slots?date=2024-01-15&timeSlotId=timeslot_id
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Available slots",
  "data": {
    "date": "2024-01-15",
    "timeSlotConfig": {
      "id": "timeslot_id",
      "startTime": "09:00",
      "endTime": "17:00"
    },
    "availableSlots": [
      {
        "slotId": "slot_1",
        "startTime": "09:00",
        "endTime": "10:00",
        "isAvailable": true
      },
      {
        "slotId": "slot_2",
        "startTime": "10:00",
        "endTime": "11:00",
        "isAvailable": false
      }
    ]
  }
}
```

#### 2. Create Appointment
```
POST /api/v1/appointment
```

**Request Body:**
```json
{
  "sessionId": "session_123",
  "date": "2024-01-15",
  "timeSlot": "slot_1",
  "timeSlotId": "timeslot_id", // Optional, uses active config if not provided
  "location": "Main Office",
  "notes": "Customer inquiry"
}
```

#### 3. Get Time Slot Configurations (for frontend)
```
GET /api/v1/appointment/time-slots?isActive=true
```

## Usage Examples

### Example 1: Create a Basic Time Slot Configuration
```bash
curl -X POST http://localhost:3000/api/v1/timeslot \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "09:00",
    "endTime": "18:00",
    "duration": 30
  }'
```

### Example 2: Create Time Slot with Break Time
```bash
curl -X POST http://localhost:3000/api/v1/timeslot \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "08:00",
    "endTime": "16:00",
    "breakTime": "12:00",
    "duration": 45
  }'
```

### Example 3: Get Available Slots
```bash
curl "http://localhost:3000/api/v1/appointment/slots?date=2024-01-15"
```

### Example 4: Book an Appointment
```bash
curl -X POST http://localhost:3000/api/v1/appointment \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user_123",
    "date": "2024-01-15",
    "timeSlot": "slot_1",
    "location": "Main Office"
  }'
```

## Time Slot Generation Logic

The system automatically generates time slots based on the following logic:

1. **Start Time**: Beginning of the working period
2. **End Time**: End of the working period
3. **Duration**: Length of each appointment slot in minutes
4. **Break Time**: Optional break period (e.g., lunch break)

### Generation Process:
1. Start from the start time
2. Create slots of the specified duration
3. If break time is specified and there's room for it:
   - Add a break slot at the specified break time
   - Continue creating appointment slots after the break
4. Stop when adding another slot would exceed the end time

### Example Generation:
- **Start Time**: 09:00
- **End Time**: 17:00
- **Duration**: 60 minutes
- **Break Time**: 12:00 (1 hour)

**Generated Slots:**
- slot_1: 09:00 - 10:00
- slot_2: 10:00 - 11:00
- slot_3: 11:00 - 12:00
- break_3: 12:00 - 13:00 (break)
- slot_4: 13:00 - 14:00
- slot_5: 14:00 - 15:00
- slot_6: 15:00 - 16:00
- slot_7: 16:00 - 17:00

## Validation Rules

1. **Time Format**: Must be in HH:MM format (24-hour)
2. **Start Time**: Must be before end time
3. **Duration**: Must be between 15 minutes and 8 hours
4. **Break Time**: Must be within the working hours
5. **Slot Validation**: Appointments can only be booked for valid, non-break slots

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **400**: Bad Request (invalid parameters)
- **404**: Not Found (time slot or appointment not found)
- **409**: Conflict (slot already booked)
- **500**: Internal Server Error

## Frontend Integration

1. **Load Time Slot Configurations**: Use `GET /api/v1/appointment/time-slots`
2. **Get Available Slots**: Use `GET /api/v1/appointment/slots?date=YYYY-MM-DD`
3. **Book Appointment**: Use `POST /api/v1/appointment`
4. **Admin Management**: Use the time slot CRUD endpoints for configuration

## Schema Changes

The time slot schema has been simplified by removing the following fields:
- `name`: No longer required for time slot identification
- `createdBy`: No longer tracks which admin created the configuration

The simplified schema now only includes:
- `startTime`: Start time of the working period
- `endTime`: End time of the working period  
- `breakTime`: Optional break time
- `duration`: Duration of each appointment slot in minutes
- `isActive`: Whether the configuration is active
- `generatedSlots`: Automatically generated time slots

This system provides complete flexibility for managing appointment time slots while maintaining data integrity and validation.
