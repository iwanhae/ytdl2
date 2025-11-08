# YTDL2 - React PWA with TypeScript and Tailwind CSS

A modern Progressive Web App built with React, TypeScript, and Tailwind CSS using Vite as the build tool.

## Features

✅ **Progressive Web App (PWA)** - Installable, works offline, and provides a native app-like experience  
✅ **Pure Client-Side Rendering (CSR)** - No server-side rendering, perfect for static hosting  
✅ **React 19 with TypeScript** - Type-safe component development  
✅ **Tailwind CSS** - Utility-first CSS framework for rapid UI development  
✅ **Vite** - Lightning-fast development and optimized production builds  
✅ **Static Build Output** - Builds to static files ready for nginx or any static file server

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

## Getting Started

### Development

Start the development server with hot module replacement:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

Build the app for production:

```bash
npm run build
```

This will:
1. Run TypeScript compilation checks
2. Bundle and optimize all assets
3. Generate service worker for PWA functionality
4. Output static files to the `dist/` directory

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

### Linting

Run ESLint to check code quality:

```bash
npm run lint
```

## Project Structure

```
ytdl2/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images, icons, etc.
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # App entry point
│   └── index.css       # Global styles (Tailwind directives)
├── dist/               # Production build output (generated)
├── index.html          # HTML entry point
├── vite.config.ts      # Vite configuration with PWA plugin
├── tailwind.config.js  # Tailwind CSS configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies and scripts
```

## Deployment with Nginx

### 1. Build the Project

```bash
npm run build
```

### 2. Configure Nginx

Create or update your nginx configuration (e.g., `/etc/nginx/sites-available/ytdl2`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Serve static files from the dist directory
    root /path/to/ytdl2/dist;
    index index.html;
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Handle client-side routing - redirect all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Service worker should not be cached
    location /sw.js {
        add_header Cache-Control "no-cache";
        proxy_cache_bypass $http_pragma;
        proxy_cache_revalidate on;
    }
    
    # Web app manifest
    location /manifest.webmanifest {
        add_header Cache-Control "no-cache";
    }
}
```

### 3. Enable the Site (Debian/Ubuntu)

```bash
sudo ln -s /etc/nginx/sites-available/ytdl2 /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### 4. HTTPS Configuration (Recommended for PWA)

PWA features like service workers require HTTPS in production. Use Let's Encrypt with Certbot:

```bash
sudo certbot --nginx -d yourdomain.com
```

## PWA Configuration

The PWA is configured in `vite.config.ts` using the `vite-plugin-pwa` plugin. Key features:

- **Auto-update**: Service worker automatically updates in the background
- **Offline support**: App works offline after first visit
- **Installable**: Users can install the app on their devices
- **Manifest**: Web app manifest defines app appearance and behavior

### Customizing PWA

Edit the PWA configuration in `vite.config.ts`:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Your App Name',
    short_name: 'App',
    description: 'Your app description',
    theme_color: '#ffffff',
    // ... more options
  }
})
```

### Adding PWA Icons

Place your PWA icons in the `public/` directory:
- `pwa-192x192.png` - 192x192 icon
- `pwa-512x512.png` - 512x512 icon
- `favicon.ico` - Browser favicon

## Tailwind CSS

Tailwind CSS is configured and ready to use. The configuration file is `tailwind.config.js`.

### Custom Utilities

Add custom utilities in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      'brand': '#your-color',
    },
    animation: {
      'your-animation': 'your-animation-name 1s ease-in-out',
    }
  }
}
```

## TypeScript

The project uses TypeScript with strict type checking. Configuration files:

- `tsconfig.json` - Main TypeScript config
- `tsconfig.app.json` - App-specific config
- `tsconfig.node.json` - Node/Vite config

## Tech Stack

- **React 19** - UI library
- **TypeScript 5.9** - Type safety
- **Vite 7** - Build tool and dev server
- **Tailwind CSS 4** - Styling
- **vite-plugin-pwa** - PWA support
- **Workbox** - Service worker library

## Browser Support

The app targets modern browsers with ES modules support:
- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
