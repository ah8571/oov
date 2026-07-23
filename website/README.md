# Ali Landing Page

Minimal, black-background landing page for the Emmaline AI Phone Call Buddy app.

## Features

- **Minimal Design**: Clean, black background with white text
- **Video Background Ready**: Easily add background video with commented code
- **Newsletter Signup**: Email collection form connected to backend
- **Responsive**: Works on all devices
- **Social Links**: Links to social media profiles
- **Fast**: Built with Next.js 14 and Tailwind CSS

## Getting Started

### Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

### Environment Variables

Create a `.env.local` file:

```env
# Backend URL for newsletter endpoint
BACKEND_URL=http://localhost:3000
```

When deployed to DigitalOcean, set:
```env
BACKEND_URL=https://oov.digital
```

### Adding Background Video

1. Place your demo video at `public/demo.mp4`
2. Uncomment the video element in `src/app/page.tsx`

```jsx
<video 
  className="video-background" 
  autoPlay 
  muted 
  loop 
  playsInline
  src="/demo.mp4"
/>
```

## Project Structure

```
website/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── api/
│   │       └── newsletter/      # Newsletter signup API
│   ├── components/
│   │   ├── Newsletter.tsx       # Email signup form
│   │   └── SocialLinks.tsx      # Social media links
│   └── globals.css             # Global styles
├── public/                      # Static files (add video here)
├── package.json
├── next.config.js
├── tailwind.config.ts
└── postcss.config.js
```

## Customization

### Change colors
Edit `tailwind.config.ts` to modify the color scheme.

### Add sections
Add new components to `src/components/` and import them in `page.tsx`.

### Connect to email service
Update the newsletter API endpoint to send emails via Mailchimp, ConvertKit, etc.

## Deployment

When deployed to DigitalOcean App Platform:

1. Build command: `npm install && npm run build`
2. Run command: `npm start`
3. Port: `3000` (can be configured with `PORT` env var)

The landing page will be available at `https://oov.digital`
And the backend API at `https://api.oov.digital/api/`

## License

Same as parent Emmaline project (GPL-3.0)
