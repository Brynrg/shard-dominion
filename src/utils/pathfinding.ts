export class PathFinder {
  private static readonly DIRECTIONS = [
    { x: 0, y: -1 }, // up
    { x: 1, y: 0 },  // right
    { x: 0, y: 1 },  // down
    { x: -1, y: 0 }  // left
  ];

  static findPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    terrain: number[][],
    isWalkable: (x: number, y: number) => boolean
  ): { x: number; y: number }[] {
    const openSet: { x: number; y: number }[] = [start];
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, { x: number; y: number }>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const startKey = `${start.x},${start.y}`;
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start, end));

    while (openSet.length > 0) {
      // Find node with lowest fScore
      let current = openSet[0];
      let currentIndex = 0;
      let currentKey = `${current.x},${current.y}`;
      let currentFScore = fScore.get(currentKey) || Infinity;

      for (let i = 1; i < openSet.length; i++) {
        const node = openSet[i];
        const nodeKey = `${node.x},${node.y}`;
        const nodeFScore = fScore.get(nodeKey) || Infinity;
        
        if (nodeFScore < currentFScore) {
          current = node;
          currentIndex = i;
          currentKey = nodeKey;
          currentFScore = nodeFScore;
        }
      }

      // If we reached the goal
      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(cameFrom, current);
      }

      // Move current from open to closed set
      openSet.splice(currentIndex, 1);
      closedSet.add(currentKey);

      // Check neighbors
      for (const dir of this.DIRECTIONS) {
        const neighbor = { x: current.x + dir.x, y: current.y + dir.y };
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // Skip if out of bounds or not walkable
        if (!this.isValidPosition(neighbor, terrain) || !isWalkable(neighbor.x, neighbor.y)) {
          continue;
        }

        // Skip if already in closed set
        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeGScore = (gScore.get(currentKey) || 0) + 1;

        if (!openSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
          openSet.push(neighbor);
        } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
          continue;
        }

        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, end));
      }
    }

    // No path found
    return [];
  }

  private static heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
    // Manhattan distance
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private static reconstructPath(
    cameFrom: Map<string, { x: number; y: number }>,
    current: { x: number; y: number }
  ): { x: number; y: number }[] {
    const path = [current];
    while (cameFrom.has(`${current.x},${current.y}`)) {
      current = cameFrom.get(`${current.x},${current.y}`)!;
      path.unshift(current);
    }

    return path;
  }

  private static isValidPosition(pos: { x: number; y: number }, terrain: number[][]): boolean {
    return pos.x >= 0 && pos.x < terrain[0].length && pos.y >= 0 && pos.y < terrain.length;
  }

  static findPathTo(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    terrain: number[][],
    buildings: { x: number; y: number; type: string }[]
  ): { x: number; y: number }[] {
    const start = { x: startX, y: startY };
    const end = { x: endX, y: endY };

    return this.findPath(start, end, terrain, (x, y) => {
      if (x < 0 || x >= terrain[0].length || y < 0 || y >= terrain.length) {
        return false;
      }
      // Block water and mountains
      if (terrain[y][x] === 3 || terrain[y][x] === 4) {
        return false;
      }
      // Block buildings
      if (buildings.some(b => b.x === x && b.y === y)) {
        return false;
      }
      return true;
    });
  }
}