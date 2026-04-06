#!/bin/bash

# Warehouse Backend - Development Setup Script
# This script automates the initial setup process

set -e

echo "📦 Warehouse Backend - Setup Script"
echo "========================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  wrangler not found. Installing locally..."
    npm install -D wrangler
fi

echo "✅ wrangler is available"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

echo "✅ Dependencies installed"

# Check if .dev.vars exists
if [ ! -f .dev.vars ]; then
    echo ""
    echo "📝 Creating .dev.vars file..."
    cp .dev.vars.example .dev.vars
    
    # Generate a random secret
    SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    
    # Replace the placeholder secret
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-random-secret-at-least-32-chars/$SECRET/" .dev.vars
    else
        # Linux
        sed -i "s/your-random-secret-at-least-32-chars/$SECRET/" .dev.vars
    fi
    
    echo "✅ .dev.vars created with generated secret"
    echo ""
    echo "⚠️  IMPORTANT: You still need to add your DATABASE_URL to .dev.vars"
    echo "   Get it from https://neon.tech after creating a project"
else
    echo "✅ .dev.vars already exists"
fi

# Ask if user wants to create R2 bucket
echo ""
read -p "Do you want to create an R2 bucket now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🪣 Creating R2 bucket..."
    npx wrangler r2 bucket create warehouse-videos || echo "⚠️  Bucket might already exist or you need to login first (run: npx wrangler login)"
else
    echo "⏭️  Skipping R2 bucket creation. You can create it later with:"
    echo "   npx wrangler r2 bucket create warehouse-videos"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your DATABASE_URL to .dev.vars (from https://neon.tech)"
echo "2. Generate migrations: npm run db:generate"
echo "3. Run migrations: npm run db:migrate"
echo "4. Start dev server: npm run dev"
echo ""
echo "📖 See README.md for detailed instructions"
