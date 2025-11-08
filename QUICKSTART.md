# Quick Start Guide

## Installation Complete! ✓

Your React PWA project with TypeScript and Tailwind CSS is ready to use.

## What's Included

✅ **React 19** with TypeScript  
✅ **Vite 7** for fast development and optimized builds  
✅ **Tailwind CSS 4** for styling  
✅ **PWA Support** with offline capabilities  
✅ **Pure CSR** (Client-Side Rendering only)  
✅ **Static Build** ready for nginx deployment

## Quick Commands

### Start Development Server

```bash
npm run dev
```

Visit: http://localhost:5173

Features:
- Hot Module Replacement (HMR)
- Instant feedback
- TypeScript type checking
- Tailwind CSS with JIT compilation

### Build for Production

```bash
npm run build
```

Output: `dist/` directory with optimized static files

What happens:
- TypeScript compilation check
- Code bundling and minification
- Tree-shaking unused code
- Asset optimization
- Service worker generation
- PWA manifest creation

### Preview Production Build Locally

```bash
npm run preview
```

Test your production build before deployment.

### Lint Code

```bash
npm run lint
```

Check code quality with ESLint.

## Project Structure

```
├── src/
│   ├── App.tsx          - Main component (uses Tailwind CSS)
│   ├── main.tsx         - App entry point
│   └── index.css        - Global styles (Tailwind import)
├── public/              - Static assets
├── dist/                - Build output (git-ignored)
├── vite.config.ts       - Vite & PWA configuration
├── tailwind.config.js   - Tailwind configuration
├── nginx.conf.example   - Example nginx configuration
└── package.json         - Dependencies and scripts
```

## Making Changes

### 1. Edit Components

Edit `src/App.tsx` - changes will hot-reload instantly:

```tsx
function App() {
  return (
    <div className="bg-blue-500 text-white p-4">
      Hello Tailwind!
    </div>
  )
}
```

### 2. Add Tailwind Classes

Use any Tailwind utility class:
- Layout: `flex`, `grid`, `container`
- Spacing: `p-4`, `m-2`, `space-x-4`
- Colors: `bg-blue-500`, `text-red-600`
- And thousands more...

See: https://tailwindcss.com/docs

### 3. Create New Components

```bash
# Create a new component
touch src/components/MyComponent.tsx
```

```tsx
// src/components/MyComponent.tsx
export function MyComponent() {
  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      My Component
    </div>
  )
}
```

### 4. Customize Tailwind

Edit `tailwind.config.js` to add custom colors, spacing, etc.:

```javascript
export default {
  theme: {
    extend: {
      colors: {
        'brand': '#0066cc',
      }
    },
  },
}
```

## PWA Features

### Testing PWA Locally

1. Build the app: `npm run build`
2. Preview it: `npm run preview`
3. Open Chrome DevTools → Application tab
4. Check:
   - Service Worker registered
   - Manifest loaded
   - Cache storage working

### PWA Configuration

Edit `vite.config.ts` to customize:
- App name and description
- Theme colors
- Icons
- Caching strategy

## Deployment to Nginx

### Quick Deploy

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Copy files to server:**
   ```bash
   scp -r dist/* user@server:/var/www/ytdl2/
   ```

3. **Configure nginx:**
   ```bash
   # Copy example config
   sudo cp nginx.conf.example /etc/nginx/sites-available/ytdl2
   # Edit it with your domain and paths
   sudo nano /etc/nginx/sites-available/ytdl2
   # Enable site
   sudo ln -s /etc/nginx/sites-available/ytdl2 /etc/nginx/sites-enabled/
   # Test and reload
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **Enable HTTPS (recommended for PWA):**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Important for PWA

- HTTPS is **required** for service workers in production
- Configure proper caching headers (see nginx.conf.example)
- Don't cache sw.js or manifest files

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### PWA Not Working

- Make sure you're using HTTPS (or localhost)
- Clear service worker cache in DevTools
- Check Console for errors

### Tailwind Styles Not Applying

- Check `src/index.css` has `@import "tailwindcss";`
- Verify `postcss.config.js` includes `@tailwindcss/postcss`
- Restart dev server

## Next Steps

1. **Customize the UI** - Edit `src/App.tsx`
2. **Add routing** - Install `react-router-dom` if needed
3. **Add state management** - Use React Context or install Redux/Zustand
4. **Add PWA icons** - Create 192x192 and 512x512 PNG icons
5. **Configure manifest** - Edit PWA settings in `vite.config.ts`
6. **Deploy** - Use the nginx configuration to deploy

## Resources

- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)
- [Vite Docs](https://vite.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)

## Need Help?

Check the main README.md for detailed documentation.

---

**Happy coding! 🚀**

