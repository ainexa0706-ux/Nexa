# Nexa Google Login Setup

Nexa supports real Google OAuth login. The app does not ship with Google credentials.

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Client ID for a web application.
5. Add this authorized redirect URI:

```text
http://localhost:8787/api/auth/google/callback
```

For a public server, use your HTTPS domain instead:

```text
https://your-domain.example/api/auth/google/callback
```

6. Copy `.env.example` to `.env`.
7. Fill these values:

```env
APP_PUBLIC_URL=http://localhost:8787
GOOGLE_CLIENT_ID=your-real-client-id
GOOGLE_CLIENT_SECRET=your-real-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/api/auth/google/callback
```

8. Restart Nexa.

The Google button becomes enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present.
