# Troubleshooting Guide

Common issues and solutions for the AI System Design Assistant.

## Build Errors

### Error: Cannot find module 'autoprefixer'

**Symptom:**
```
Error: Cannot find module 'autoprefixer'
```

**Solution:**
```bash
npm install -D autoprefixer --legacy-peer-deps
```

**Why it happens:** Autoprefixer is required by Tailwind CSS but wasn't included in the initial package.json.

### Error: ERESOLVE could not resolve

**Symptom:**
```
npm ERR! ERESOLVE could not resolve
npm ERR! Conflicting peer dependency
```

**Solution:**
Use the `--legacy-peer-deps` flag:
```bash
npm install --legacy-peer-deps
```

Or add to `.npmrc`:
```
legacy-peer-deps=true
```

### Error: Module not found

**Solution:**
1. Clear cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

2. Clear Next.js cache:
```bash
rm -rf .next
npm run dev
```

## Runtime Errors

### Error: watsonx.ai credentials not configured

**Symptom:**
```
Error: watsonx.ai credentials not configured
```

**Solution:**
1. Create `.env.local` file:
```bash
cp .env.example .env.local
```

2. Add your credentials:
```env
WATSONX_API_KEY=your_api_key
WATSONX_PROJECT_ID=your_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

3. Restart the dev server

### Error: Failed to connect to database

**Symptom:**
```
Error: Failed to connect to database
SQLITE_CANTOPEN: unable to open database file
```

**Solution:**
1. Create data directory:
```bash
mkdir -p data
chmod 755 data
```

2. Check permissions:
```bash
ls -la data/
```

### Error: Port 3000 already in use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
1. Use a different port:
```bash
PORT=3001 npm run dev
```

2. Or kill the process using port 3000:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## API Errors

### Error: 401 Unauthorized from watsonx.ai

**Symptom:**
API calls return 401 status

**Solution:**
1. Verify API key is correct in `.env.local`
2. Check if API key has expired
3. Regenerate credentials in IBM Cloud Console

### Error: 429 Too Many Requests

**Symptom:**
```
Error: Rate limit exceeded
```

**Solution:**
1. Wait a few minutes before retrying
2. Check your watsonx.ai usage limits
3. Implement request throttling in your code

### Error: Timeout waiting for response

**Symptom:**
```
Error: Request timeout after 30000ms
```

**Solution:**
1. Check internet connection
2. Verify watsonx.ai service status
3. Increase timeout in watsonx-client.ts

## UI Issues

### Mermaid diagrams not rendering

**Symptom:**
Diagrams show as blank or error message

**Solution:**
1. Clear browser cache
2. Check browser console for errors
3. Verify Mermaid syntax is valid
4. Try a different browser

### Styles not loading

**Symptom:**
Page appears unstyled

**Solution:**
1. Verify Tailwind CSS is configured:
```bash
# Check if these files exist
ls tailwind.config.js
ls postcss.config.js
```

2. Rebuild:
```bash
rm -rf .next
npm run dev
```

### Images not loading

**Symptom:**
404 errors for images

**Solution:**
1. Place images in `public/` directory
2. Reference with `/image.png` (not `./image.png`)
3. Check file permissions

## Database Issues

### Error: Database is locked

**Symptom:**
```
Error: SQLITE_BUSY: database is locked
```

**Solution:**
1. Close other connections to the database
2. Restart the application
3. Delete `.db-shm` and `.db-wal` files:
```bash
rm data/*.db-shm data/*.db-wal
```

### Error: Table doesn't exist

**Symptom:**
```
Error: no such table: projects
```

**Solution:**
Database needs to be initialized. The tables are created automatically on first API call. Try:
1. Delete the database file:
```bash
rm data/app.db
```

2. Restart the server - tables will be recreated

## Performance Issues

### Slow API responses

**Symptoms:**
- Requests take > 10 seconds
- Timeout errors

**Solutions:**
1. Check watsonx.ai service status
2. Reduce max_new_tokens in prompts
3. Use faster models (e.g., Granite-13b instead of Llama-70b)
4. Implement caching

### High memory usage

**Solution:**
1. Restart the dev server periodically
2. Clear Next.js cache:
```bash
rm -rf .next
```

3. Check for memory leaks in custom code

## Deployment Issues

### Error: Build fails in production

**Solution:**
1. Test production build locally:
```bash
npm run build
npm start
```

2. Check for environment-specific issues
3. Verify all environment variables are set

### Error: Database not persisting in Docker

**Solution:**
1. Mount volume for data directory:
```yaml
volumes:
  - ./data:/app/data
```

2. Ensure directory has correct permissions

## Getting More Help

### Enable Debug Mode

Add to `.env.local`:
```env
DEBUG=true
LOG_LEVEL=debug
```

### Check Logs

```bash
# Development logs
npm run dev

# Production logs
npm start

# Docker logs
docker logs <container-id>
```

### Useful Commands

```bash
# Check Node version
node --version

# Check npm version
npm --version

# List installed packages
npm list --depth=0

# Check for outdated packages
npm outdated

# Audit for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

### Still Having Issues?

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the documentation:
   - [SETUP_GUIDE.md](./SETUP_GUIDE.md)
   - [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)
   - [IBM_CLOUD_DEPLOYMENT.md](./IBM_CLOUD_DEPLOYMENT.md)
3. Contact support or create a new issue

## Common Warning Messages (Safe to Ignore)

### EBADENGINE warnings

```
npm WARN EBADENGINE Unsupported engine
```

**Status:** Safe to ignore. These are just warnings about Node version compatibility.

### Peer dependency warnings

```
npm WARN peer dependency
```

**Status:** Usually safe to ignore if the app runs correctly.

### Next.js telemetry

```
Attention: Next.js now collects completely anonymous telemetry
```

**Status:** Informational only. You can opt-out if desired.

## Prevention Tips

1. **Always use `--legacy-peer-deps`** when installing new packages
2. **Keep `.env.local` updated** with valid credentials
3. **Regularly clear cache** if experiencing issues
4. **Test locally** before deploying
5. **Keep dependencies updated** but test after updates
6. **Backup database** before major changes

---

Last updated: 2026-05-01