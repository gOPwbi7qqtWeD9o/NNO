# SSL/HTTPS Certificate Setup

This guide helps you set up SSL certificates for secure HTTPS connections in your Terminal Chat application.

## Quick Start

### Option 1: Trusted Certificates (Recommended)
Using `mkcert` creates certificates trusted by your browser:

```bash
# Install mkcert (Windows)
choco install mkcert

# Initialize mkcert
mkcert -install

# Generate certificates
npm run cert:mkcert

# Run with HTTPS
npm run dev:https
```

### Option 2: Self-Signed Certificates
For basic SSL (browser will show security warning):

```bash
# Generate self-signed certificate
npm run cert:generate

# Run with HTTPS
npm run dev:https
```

## Commands

- `npm run dev` - HTTP development server (port 3000)
- `npm run dev:https` - HTTPS development server (port 3000)
- `npm run cert:generate` - Generate self-signed certificate
- `npm run cert:mkcert` - Generate trusted certificate (requires mkcert)

## Files Created

After running certificate generation:
```
certs/
├── cert.pem  # Certificate file
└── key.pem   # Private key file
```

## Installation Guides

### Windows
```bash
# Using Chocolatey
choco install mkcert

# Using Scoop
scoop install mkcert
```

### macOS
```bash
brew install mkcert
```

### Linux
See: https://github.com/FiloSottile/mkcert#installation

## Troubleshooting

### Certificate Not Trusted
1. Install mkcert: Follow installation guide above
2. Initialize: `mkcert -install`
3. Generate: `npm run cert:mkcert`

### OpenSSL Not Found
- **Windows**: Install Git Bash or Windows Subsystem for Linux (WSL)
- **Alternative**: Use `npm run cert:mkcert` instead

### Port Already in Use
The HTTPS server will use the same port (3000) as HTTP. Make sure to stop the HTTP server first.

## Environment Variables

- `HTTPS=true` - Enable HTTPS mode
- `PORT=3000` - Server port (default: 3000)
- `NODE_ENV=production` - Production mode

## Security Notes

- Self-signed certificates will show browser warnings
- Trusted certificates (mkcert) work seamlessly in development
- Never commit certificate files to version control
- Certificates are automatically ignored by .gitignore
