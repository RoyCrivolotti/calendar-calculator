# Calendar Calculator

A React-based calendar application for tracking on-call shifts and calculating compensation.

## Features

- Interactive calendar interface for managing on-call shifts and incidents
- Automatic compensation calculation based on:
  - Weekday/weekend rates
  - Night shift bonuses
  - Incident multipliers
- Monthly compensation summaries
- Detailed breakdown of hours and compensation
- Local storage persistence

## Tech Stack

- React
- TypeScript
- FullCalendar
- Emotion (styled-components)
- Redux Toolkit
- date-fns

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

## Project Structure

```
src/
├── application/        # Application use cases
├── domain/            # Domain entities and business logic
├── infrastructure/    # Infrastructure implementations
└── presentation/      # React components and UI logic
```

## License

MIT
