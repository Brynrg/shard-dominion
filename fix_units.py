#!/usr/bin/env python3
import re

# Read the file
with open('src/data/units.ts', 'r') as f:
    content = f.read()

# Fix 1: Remove the extra closing brace at the end
content = content.rstrip()
if content.endswith('};'):
    # Check if there's an extra closing brace
    if content.count('};') > 1:
        # Remove the last closing brace
        content = content[:-2].rstrip()

# Fix 2: Remove the duplicate behemoth entry
# Find the second behemoth and remove it
pattern = r'  // Forge Unique Units\s*\n  behemoth: \{[^}]+\},\s*\n  siege: \{'
replacement = '  // Forge Unique Units\n  siege: {'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix 3: Remove attackType: 'none' from carryall
content = content.replace("    attackType: 'none',", "")

# Fix 4: Add size and health to construction building
# First, remove any existing size/health in construction
content = re.sub(
    r'  construction: \{[^}]*\n    faction: Faction\.VANGUARD,\n    cost: 200,\n    produces: \[.*?\],\n  \}',
    "  construction: {\n    id: 'construction',\n    name: 'Construction Yard',\n    faction: Faction.VANGUARD,\n    size: 3,\n    health: 500,\n    cost: 200,\n    produces: ['infantry', 'scout', 'tank']\n  }",
    content,
    flags=re.DOTALL
)

# Fix 5: Add size and health to nexus building
# First, remove any existing size/health in nexus
content = re.sub(
    r'  nexus: \{[^}]*\n    faction: Faction\.PHANTOM,\n    cost: 350,\n    produces: \[.*?\],\n  \}',
    "  nexus: {\n    id: 'nexus',\n    name: 'Command Nexus',\n    faction: Faction.PHANTOM,\n    size: 3,\n    health: 400,\n    cost: 350,\n    produces: ['stealth']\n  }",
    content,
    flags=re.DOTALL
)

# Write the fixed content
with open('src/data/units.ts', 'w') as f:
    f.write(content)

print("File fixed successfully")