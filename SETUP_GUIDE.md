# Setup Guide - AI System Design Assistant

This guide will help you set up and run the AI System Design Assistant locally.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or higher
- **npm** 9.x or higher
- **Git** (for version control)
- **IBM Cloud Account** (for watsonx.ai access)

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd ibm_hackathon
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- IBM watsonx.ai SDK
- SQLite (better-sqlite3)
- Mermaid (for diagrams)
- And more...

## Step 3: Set Up IBM watsonx.ai

### 3.1 Create IBM Cloud Account

1. Go to [IBM Cloud](https://cloud.ibm.com)
2. Sign up for a free account or log in
3. Navigate to the IBM watsonx.ai service

### 3.2 Get API Credentials

1. In IBM Cloud Console, go to **Resource List**
2. Find your watsonx.ai service instance
3. Click on **Service credentials**
4. Create new credentials or use existing ones
5. Note down:
   - API Key
   - Project ID
   - Service URL (usually `https://us-south.ml.cloud.ibm.com`)

### 3.3 Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:

```env
# watsonx.ai Configuration
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Application Configuration
NODE_ENV=development
PORT=3000
```

**Important**: Never commit `.env.local` to version control!

## Step 4: Initialize the Database

The SQLite database will be automatically created when you first run the application. The database file will be stored in the `data/` directory.

To manually initialize or reset the database:

```bash
# Create data directory
mkdir -p data

# The database will be created automatically on first API call
```

## Step 5: Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Step 6: Verify Setup

### Test watsonx.ai Connection

You can test your watsonx.ai connection using the test script:

```bash
npm run test:watsonx
```

This will verify that your API credentials are correct and the service is accessible.

### Test the Application

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. You should see the landing page
3. Try creating a test project:
   - Select a skill level
   - Enter a project description (at least 50 characters)
   - Click "Start Design Process"

## Project Structure

```
ibm_hackathon/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API routes
│   │   │   ├── projects/         # Project management
│   │   │   ├── clarify/          # Clarification endpoints
│   │   │   ├── architecture/     # Architecture generation
│   │   │   ├── diagrams/         # Diagram generation
│   │   │   └── export/           # Export functionality
│   │   ├── project/[id]/         # Project pages
│   │   │   ├── clarify/          # Clarification page
│   │   │   ├── architecture/     # Architecture selection
│   │   │   ├── design/           # Design detail view
│   │   │   └── export/           # Export page
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Landing page
│   │   └── globals.css           # Global styles
│   ├── components/               # React components
│   │   ├── ui/                   # Reusable UI components
│   │   └── visualization/        # Diagram components
│   ├── lib/                      # Utility libraries
│   │   ├── database.ts           # SQLite operations
│   │   ├── watsonx-client.ts     # watsonx.ai integration
│   │   └── utils.ts              # Helper functions
│   └── types/                    # TypeScript types
├── public/                       # Static assets
├── data/                         # SQLite database (auto-created)
├── scripts/                      # Utility scripts
└── [config files]                # Various configuration files
```

## Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed example data

# Testing
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:watsonx     # Test watsonx.ai connection

# Deployment
./scripts/deploy-ibm-cloud.sh  # Deploy to IBM Cloud
```

## Common Issues and Solutions

### Issue: "watsonx.ai credentials not configured"

**Solution**: Make sure you've created `.env.local` with valid credentials:
```bash
WATSONX_API_KEY=your_key
WATSONX_PROJECT_ID=your_project_id
```

### Issue: "Failed to connect to database"

**Solution**: Ensure the `data/` directory exists and has write permissions:
```bash
mkdir -p data
chmod 755 data
```

### Issue: "Module not found" errors

**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port 3000 already in use

**Solution**: Use a different port:
```bash
PORT=3001 npm run dev
```

### Issue: Mermaid diagrams not rendering

**Solution**: Clear browser cache and reload. Mermaid requires client-side JavaScript.

## Development Workflow

### 1. Create a New Feature

```bash
# Create a new branch
git checkout -b feature/your-feature-name

# Make your changes
# ...

# Test locally
npm run dev

# Commit and push
git add .
git commit -m "Add your feature"
git push origin feature/your-feature-name
```

### 2. Test Your Changes

```bash
# Run linter
npm run lint

# Run tests
npm run test

# Build for production
npm run build
```

### 3. Deploy to IBM Cloud

See [IBM_CLOUD_DEPLOYMENT.md](./IBM_CLOUD_DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy:
```bash
./scripts/deploy-ibm-cloud.sh
```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WATSONX_API_KEY` | IBM watsonx.ai API key | Yes | - |
| `WATSONX_PROJECT_ID` | IBM watsonx.ai project ID | Yes | - |
| `WATSONX_URL` | watsonx.ai service URL | No | `https://us-south.ml.cloud.ibm.com` |
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `PORT` | Server port | No | `3000` |

## API Endpoints

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Clarification
- `POST /api/clarify` - Get next question
- `POST /api/clarify/complete` - Complete clarification

### Architecture
- `POST /api/architecture/generate` - Generate options
- `POST /api/architecture/select` - Select architecture
- `GET /api/architecture/:id/components` - Get components
- `GET /api/architecture/:id/justifications` - Get justifications

### Diagrams & Export
- `POST /api/diagrams/generate` - Generate diagram
- `POST /api/export` - Export project

## Database Schema

The application uses SQLite with the following tables:

- **projects**: Project information
- **conversations**: Chat history
- **architectures**: Generated architectures
- **exports**: Export history

See [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) for detailed schema.

## Troubleshooting

### Enable Debug Logging

Add to `.env.local`:
```env
DEBUG=true
LOG_LEVEL=debug
```

### Check Database

```bash
# Install SQLite CLI
brew install sqlite3  # macOS
apt-get install sqlite3  # Linux

# Open database
sqlite3 data/app.db

# List tables
.tables

# Query data
SELECT * FROM projects;
```

### Clear Cache

```bash
# Clear Next.js cache
rm -rf .next

# Clear node modules
rm -rf node_modules
npm install
```

## Getting Help

- **Documentation**: See all `*.md` files in the root directory
- **Issues**: Check existing issues or create a new one
- **IBM watsonx.ai Docs**: https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-overview.html
- **Next.js Docs**: https://nextjs.org/docs

## Next Steps

1. ✅ Complete setup following this guide
2. ✅ Test the application locally
3. ✅ Create your first project
4. ✅ Review the generated architecture
5. ✅ Export documentation
6. 🚀 Deploy to IBM Cloud

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Your License Here]

---

**Need Help?** Check the other documentation files:
- [README.md](./README.md) - Project overview
- [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) - Technical details
- [IBM_CLOUD_DEPLOYMENT.md](./IBM_CLOUD_DEPLOYMENT.md) - Deployment guide
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Implementation details