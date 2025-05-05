# On-Call & Incident Calendar Calculator

A React-based calendar application for tracking on-call shifts, managing incidents, and calculating compensation with advanced visualization.

## Features

### Core Functionality
- **Interactive Calendar Interface**: Manage on-call shifts and incidents with an intuitive UI
- **Automatic Compensation Calculation**: 
  - Differentiated weekday/weekend rates
  - Night shift bonuses (40% premium)
  - Incident response multipliers
  - Holiday detection
- **Monthly Compensation Summaries**: Visual breakdown of earnings with charts
- **Detailed Analytics**: Hour tracking and compensation distribution
- **Local Storage Persistence**: All data is stored locally in the browser

### Key Modules
1. **Calendar View**: Main interface for adding and managing events
2. **Event Editor**: Create and modify on-call shifts and incidents
3. **Monthly Summary**: Visual breakdown of compensation with charts and detailed analysis
   - Hours breakdown by category (bar chart)
   - Compensation distribution (pie chart)
   - Detailed event listings

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **State Management**: React Hooks (useState, useContext, useMemo)
- **Styling**: Emotion (styled-components)
- **Date Handling**: date-fns
- **Calendar Component**: FullCalendar
- **Charts**: Custom SVG-based charts
- **Storage**: Browser LocalStorage with structured serialization
- **Error Handling**: Centralized error tracking and logging

## System Architecture

Below are visual representations of the application's architecture and key processes.

### Application Architecture

```mermaid
graph TD
    User[User] -->|Interacts with| UI[UI Components]
    UI -->|Renders| Calendar[Calendar View]
    UI -->|Renders| EventEditor[Event Editor]
    UI -->|Renders| Summary[Monthly Summary]
    
    UI -->|Uses| PresentationServices[Presentation Services]
    PresentationServices -->|Uses| StorageService[Storage Service]
    
    UI -->|Calls| DomainServices[Domain Services]
    DomainServices -->|Uses| Entities[Domain Entities]
    DomainServices -->|Uses| Constants[Business Constants]
    
    StorageService -->|Persists| LocalStorage[(Browser LocalStorage)]
    
    subgraph "Presentation Layer"
        UI
        PresentationServices
        Calendar
        EventEditor
        Summary
    end
    
    subgraph "Domain Layer"
        DomainServices
        Entities
        Constants
    end
    
    subgraph "Infrastructure Layer"
        StorageService
        LocalStorage
    end
```

### Compensation Calculation Flow

```mermaid
flowchart TD
    Start([User views monthly summary]) --> LoadEvents[Load Events from Storage]
    LoadEvents --> LoadSubEvents[Load SubEvents]
    LoadSubEvents --> FilterMonth[Filter for Selected Month]
    
    FilterMonth --> A{Event Type?}
    A -->|On-Call| ProcessOnCall[Process On-Call Hours]
    A -->|Incident| ProcessIncident[Process Incident Hours]
    
    ProcessOnCall --> B{Time Period?}
    B -->|Weekday| CalcWeekdayOnCall[Apply Weekday Rate: €3.90/h]
    B -->|Weekend| CalcWeekendOnCall[Apply Weekend Rate: €7.34/h]
    
    ProcessIncident --> C{Time Period?}
    C -->|Weekday| CalcWeekdayIncident[Apply Base × 1.8]
    C -->|Weekend| CalcWeekendIncident[Apply Base × 2.0]
    
    CalcWeekdayIncident --> D{Night Shift?}
    CalcWeekendIncident --> D
    D -->|Yes| ApplyNightBonus[Apply Additional 1.4× Multiplier]
    D -->|No| SkipNightBonus[Skip Night Bonus]
    
    CalcWeekdayOnCall --> AggregateResults[Aggregate Results]
    CalcWeekendOnCall --> AggregateResults
    ApplyNightBonus --> AggregateResults
    SkipNightBonus --> AggregateResults
    
    AggregateResults --> GenerateBreakdown[Generate Compensation Breakdown]
    GenerateBreakdown --> RenderVisualizations[Render Charts and Tables]
    RenderVisualizations --> End([Display to User])
```

### Event Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: User creates event
    Created --> Scheduled: Save event
    Scheduled --> Active: Event time begins
    Active --> Processing: User handles incident
    Active --> Completed: Event time ends
    Processing --> Completed: Incident resolved
    Completed --> Analyzed: Calculate compensation
    Analyzed --> [*]: Display in monthly summary
    
    state Active {
        [*] --> OnCall: Monitoring
        OnCall --> Incident: Issue detected
        Incident --> Resolution: Handle issue
        Resolution --> OnCall: Resume monitoring
        OnCall --> [*]: End of shift
    }
```

## Architecture & Design Patterns

This application follows a clean, domain-driven architecture with clear separation of concerns:

### Architecture Patterns
- **Domain-Driven Design (DDD)**: Business logic encapsulated in domain entities and services
- **Clean Architecture**: Clear separation between domain, presentation, and infrastructure
- **Functional Core, Imperative Shell**: Pure business logic with side effects at the edges

### Design Patterns
- **Singleton Pattern**: Services implemented as singletons (CompensationService, EventCompensationService)
- **Facade Pattern**: CompensationCalculatorFacade provides a unified interface to complex subsystems
- **Repository Pattern**: Storage service abstracts data persistence
- **Factory Pattern**: Creation of entities with complex initialization
- **Observer Pattern**: React state management for UI updates
- **Strategy Pattern**: Different compensation strategies based on event types/time

### Component Interaction Diagram

```mermaid
sequenceDiagram
    participant User
    participant Calendar as Calendar View
    participant Editor as Event Editor
    participant Summary as Monthly Summary
    participant Calculator as CompensationCalculator
    participant Storage as Storage Service
    
    User->>Calendar: View Calendar
    Calendar->>Storage: Load Events
    Storage-->>Calendar: Return Events
    Calendar-->>User: Display Events
    
    User->>Calendar: Click "Add Event"
    Calendar->>Editor: Open Editor
    User->>Editor: Input Event Details
    Editor->>Storage: Save Event
    
    User->>Summary: View Monthly Summary
    Summary->>Storage: Load Events for Month
    Storage-->>Summary: Return Events
    Summary->>Calculator: Calculate Compensation
    Calculator-->>Summary: Return Breakdown
    Summary-->>User: Display Charts & Data
    
    User->>Summary: Toggle Breakdown View
    Summary-->>User: Update Visualization
```

### Code Organization Principles
- **Single Responsibility Principle**: Each component and service has a clear, focused purpose
- **Dependency Inversion**: High-level modules don't depend on low-level modules
- **Immutability**: State is treated as immutable for predictability

## Project Structure

```
src/
├── domain/            # Business logic, entities, and domain services
│   ├── calendar/      # Core calendar domain
│   │   ├── constants/ # Business constants like compensation rates
│   │   ├── entities/  # Domain entities (CalendarEvent, SubEvent)
│   │   ├── services/  # Domain services (CompensationService)
│   │   └── types/     # TypeScript types and interfaces
│
├── presentation/      # React components and UI logic
│   ├── components/    # UI components
│   │   ├── calendar/  # Calendar-specific components
│   │   └── common/    # Shared/reusable components
│   ├── hooks/         # Custom React hooks
│   └── services/      # Presentation-layer services (Storage)
│
└── utils/             # Shared utilities for dates, logging, etc.
```

## Data Model

```mermaid
classDiagram
    class CalendarEvent {
        +string id
        +Date start
        +Date end
        +string title
        +string type
        +boolean allDay
    }
    
    class SubEvent {
        +string id
        +string parentEventId
        +Date start
        +Date end
        +string type
        +boolean isWeekend
        +boolean isNightShift
        +boolean isHoliday
        +boolean isOfficeHours
    }
    
    class CompensationBreakdown {
        +string type
        +number amount
        +number count
        +string description
        +Date month
        +Event[] events
    }
    
    class CompensationRates {
        +number weekdayOnCallRate
        +number weekendOnCallRate
        +number baseHourlySalary
        +number weekdayIncidentMultiplier
        +number weekendIncidentMultiplier
        +number nightShiftBonusMultiplier
    }
    
    CalendarEvent "1" --> "*" SubEvent : contains
    SubEvent --> CompensationBreakdown : calculates
    CompensationRates --> CompensationBreakdown : uses
```

## Compensation Calculation Logic

Compensation is calculated based on several factors:

1. **On-Call Compensation**:
   - Weekday on-call: €3.90/hour (outside office hours)
   - Weekend on-call: €7.34/hour

2. **Incident Response**:
   - Base hourly rate: €33.50/hour
   - Weekday multiplier: 1.8x (€60.30/hour)
   - Weekend multiplier: 2.0x (€67.00/hour)
   - Night shift bonus: Additional 1.4x multiplier

3. **Office Hours**:
   - Monday-Friday, 9:00-18:00: Regular work hours, no on-call compensation

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/RoyCrivolotti/calendar-calculator.git
cd calendar-calculator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Development Notes

- **Performance Optimization**: Heavy calculations are memoized using React's useMemo
- **Data Consistency**: Compensation calculations are centralized to ensure consistency
- **Error Handling**: Comprehensive error tracking with the logger utility
- **Extensibility**: New compensation types can be added by extending the existing patterns

## License

MIT
