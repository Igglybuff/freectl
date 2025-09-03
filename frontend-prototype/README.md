# freectl Frontend Prototype

A modern React-based Progressive Web Application (PWA) frontend for freectl, replacing the existing vanilla JavaScript implementation with a robust, scalable solution.

## 🚀 Features

- **Modern React Architecture** - Built with React 18, TypeScript, and modern hooks
- **Progressive Web App** - Installable, offline-capable, mobile-first design
- **Lightning Fast** - Vite build system with optimized bundles and code splitting
- **Beautiful UI** - Tailwind CSS with dark/light theme support and smooth animations
- **Type Safety** - Full TypeScript implementation with comprehensive type definitions
- **State Management** - Zustand for global state, TanStack Query for server state
- **Responsive Design** - Mobile-first approach with excellent touch interactions
- **Accessibility** - WCAG compliant with keyboard navigation and screen reader support

## 🏗️ Tech Stack

### Core Framework
- **React 18** - Modern React with concurrent features
- **TypeScript** - Type safety and enhanced developer experience
- **Vite** - Fast build tool with HMR and optimized production builds

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework (eliminates the 1,835-line CSS problem!)
- **Lucide React** - Beautiful, consistent icons
- **clsx** - Conditional className utility

### State Management
- **Zustand** - Lightweight, flexible state management
- **TanStack Query** - Powerful server state management with caching, background updates, and more
- **React Query DevTools** - Development debugging tools

### PWA & Performance
- **Vite PWA Plugin** - Service worker generation and PWA manifest
- **Workbox** - Advanced caching strategies and offline support
- **Code Splitting** - Automatic bundle optimization

## 📦 Project Structure

```
src/
├── components/           # React components
│   ├── tabs/            # Tab-specific components
│   │   ├── SearchTab.tsx
│   │   ├── FavoritesTab.tsx
│   │   ├── LibraryTab.tsx
│   │   ├── StatsTab.tsx
│   │   └── SettingsTab.tsx
│   └── ui/              # Reusable UI components
│       ├── LoadingSpinner.tsx
│       ├── SearchResultCard.tsx
│       ├── Pagination.tsx
│       ├── CategoryFilter.tsx
│       ├── EmptyState.tsx
│       ├── ToastContainer.tsx
│       └── ErrorBoundary.tsx
├── stores/              # Zustand stores
│   └── appStore.ts      # Global application state
├── hooks/               # Custom React hooks
│   └── index.ts         # Search, themes, API interactions
├── types/               # TypeScript type definitions
│   └── index.ts         # Comprehensive type system
├── utils/               # Utility functions
│   ├── api.ts          # API client and utilities
│   └── cn.ts           # ClassName utilities
└── main.tsx            # Application entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Navigate to the prototype directory:**
   ```bash
   cd freectl/frontend-prototype
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5173`

### Backend Integration

The frontend is configured to proxy API calls to your Go backend running on `http://localhost:8080`. Make sure your freectl server is running:

```bash
# In the main freectl directory
go run main.go web
```

## 📱 PWA Features

### Installation
- **Desktop**: Install prompt appears automatically or use browser's install option
- **Mobile**: "Add to Home Screen" functionality
- **Offline Support**: Core functionality works without internet connection

### Service Worker Features
- **Caching Strategy**: API responses cached for faster subsequent loads
- **Background Updates**: Automatic updates when new versions are deployed
- **Offline Fallbacks**: Graceful degradation when network is unavailable

## 🎨 Key Improvements Over Original

### CSS Reduction
- **Before**: 1,835 lines of CSS
- **After**: ~160 lines of CSS + Tailwind utilities
- **Benefits**: Better maintainability, consistent spacing, responsive design patterns

### JavaScript Architecture
- **Before**: ~2,400 lines of vanilla JS across 9 modules
- **After**: ~2,000 lines of TypeScript with proper component architecture
- **Benefits**: Type safety, better code organization, easier testing

### Performance
- **Code Splitting**: Automatic bundle optimization
- **Tree Shaking**: Unused code elimination
- **Caching**: Smart caching strategies for API calls
- **Lazy Loading**: Components loaded on demand

### Developer Experience
- **Hot Module Replacement**: Instant updates during development
- **TypeScript**: Catch errors at compile time
- **ESLint**: Code quality and consistency
- **React DevTools**: Component debugging
- **Query DevTools**: API state inspection

## 🔧 Development Scripts

```bash
# Development server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

## 🌐 API Integration

The frontend communicates with your existing Go backend through a comprehensive API client:

- **Search**: Real-time search with debouncing and caching
- **Favorites**: Add/remove/manage favorite items
- **Sources**: CRUD operations for data sources
- **Settings**: Persistent user preferences
- **Stats**: Dashboard analytics and insights

## 📱 Mobile Experience

### Touch-First Design
- **Large Touch Targets**: 44px minimum touch targets
- **Gesture Support**: Swipe navigation, pull-to-refresh
- **Native Feel**: App-like navigation and interactions

### Performance on Mobile
- **Bundle Size**: Optimized for mobile networks
- **Code Splitting**: Load only what's needed
- **Image Optimization**: Responsive images with lazy loading
- **Service Worker**: Offline functionality

## 🎯 Next Steps

### Immediate Integration
1. **Backend Compatibility**: Ensure API endpoints match expected interfaces
2. **Authentication**: Add auth layer if needed
3. **Error Handling**: Enhance error boundaries and user feedback

### Future Enhancements
1. **Advanced Search**: Filters, sorting, search history
2. **Bulk Operations**: Multi-select for favorites and sources
3. **Data Visualization**: Charts and graphs for statistics
4. **Keyboard Shortcuts**: Power user features
5. **Collaborative Features**: Share favorites, export collections

## 🔄 Migration Strategy

### Phase 1: Side-by-side deployment
- Serve both old and new frontends
- Test with subset of users
- Gradual feature parity

### Phase 2: Feature enhancement
- Add PWA capabilities
- Improve mobile experience
- Enhanced search features

### Phase 3: Full replacement
- Deprecate old frontend
- Full PWA deployment
- Performance monitoring

## 🤝 Contributing

This prototype demonstrates modern web development practices:

- **Component-Based**: Reusable, testable components
- **Type Safety**: Comprehensive TypeScript coverage
- **Performance**: Optimized bundles and runtime performance
- **Accessibility**: WCAG 2.1 AA compliance
- **Testing Ready**: Architecture supports unit and integration tests

## 🐛 Known Limitations

- **Mock Data**: Some API endpoints may need implementation
- **Advanced Features**: Some complex features are placeholders
- **Testing**: Test suite needs to be added
- **Documentation**: API documentation could be enhanced

## 📄 License

Same as main freectl project.