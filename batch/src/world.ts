import {Cube, Color, ComponentStatus} from './cube';

type WorldCell = {
	cubeId: number | null;
};

type Algorithm = Generator<Move, void, undefined>;

enum MoveDirection {
	N = "N",
	E = "E",
	S = "S",
	W = "W",
	NW = "NW",
	NE = "NE",
	EN = "EN",
	ES = "ES",
	SE = "SE",
	SW = "SW",
	WS = "WS",
	WN = "WN"
}

/**
 * Representation of a single cube move (either slide or corner).
 */
class Move {
	constructor(public world: World, public position: [number, number], public direction: MoveDirection) {
	}

	/**
	 * Returns the coordinate of the cell we're moving from.
	 */
	sourcePosition(): [number, number] {
		return this.position;
	}

	private static targetPositionFromFields(position: [number, number], direction: string): [number, number] {
		let [x, y] = [...position];
		for (let i = 0; i < direction.length; i++) {
			switch (direction[i]) {
				case "N":
					y++;
					break;
				case "S":
					y--;
					break;
				case "E":
					x++;
					break;
				case "W":
					x--;
					break;
			}
		}
		return [x, y];
	}

	/**
	 * Returns the coordinate of the cell we're moving towards.
	 */
	targetPosition(): [number, number] {
		return Move.targetPositionFromFields(this.position, this.direction);
	}

	/**
	 * Checks if this move is valid, but ignores the connectivity requirement
	 * (i.e., still returns true if this move disconnects the configuration
	 * but otherwise is valid).
	 *
	 * This avoids the need to do a BFS to check connectivity.
	 */
	isValidIgnoreConnectivity(): boolean {
		if (this.world.getCube(this.targetPosition())) {
			return false;
		}

		let has = this.world.hasNeighbors(this.position);

		switch (this.direction) {
			case "N":
				return (has['W'] && has['NW']) || (has['E'] && has['NE']);
			case "E":
				return (has['N'] && has['NE']) || (has['S'] && has['SE']);
			case "S":
				return (has['W'] && has['SW']) || (has['E'] && has['SE']);
			case "W":
				return (has['N'] && has['NW']) || (has['S'] && has['SW']);

			default:
				// for corner moves, need to ensure that there is no cube in
				// the first direction (which would be in our way) and there
				// is a cube in the second direction (that we can pivot along)
				return !has[this.direction[0]] && has[this.direction[1]];
		}
	}

	/**
	 * Checks if this move is valid.
	 */
	isValid(): boolean {
		if (!this.isValidIgnoreConnectivity()) {
			return false;
		}
		if (!this.world.isConnected(this.position)) {
			return false;
		}
		return true;
	}
	
	/**
	 * Computes coordinates of a cube executing this move at the given time
	 * between 0 and 1.
	 */
	interpolate(time: number): [number, number] {
		time = -2 * time * time * time + 3 * time * time;

		let x: number, y: number;
		const [x1, y1] = this.sourcePosition();
		const [x2, y2] = this.targetPosition();
		if (this.direction.length === 2) {
			const [xm, ym] = Move.targetPositionFromFields(this.position, this.direction[0]);
			if (time < 0.5) {
				x = x1 + (xm - x1) * 2 * time;
				y = y1 + (ym - y1) * 2 * time;
			} else {
				x = xm + (x2 - xm) * (2 * time - 1);
				y = ym + (y2 - ym) * (2 * time - 1);
			}
		} else {
			x = x1 + (x2 - x1) * time;
			y = y1 + (y2 - y1) * time;
		}

		return [x, y];
	}

	execute(): void {
		this.world.moveCube(this.position, this.targetPosition());
	}

	executeUnmarked(): void {
		this.world.moveCubeUnmarked(this.position, this.targetPosition());
	}

	toString(): string {
		const from = this.position;
		const to = this.targetPosition();
		return `(${from[0]}, ${from[1]}) \u2192 (${to[0]}, ${to[1]})`;
	}
}


/**
 * Collection of cubes on the grid.
 */
class World {

	world: WorldCell[][] = [];
	cubes: Cube[] = [];

	currentMove: Move | null = null;

	/**
	 * Creates the world.
	 */
	constructor() {
	}

	private getColumn(x: number): WorldCell[] {
		if (!this.world[x]) {
			this.world[x] = [];
		}
		return this.world[x];
	}

	private getCell([x, y]: [number, number]): WorldCell {
		let column = this.getColumn(x);
		if (!column[y]) {
			column[y] = {
				cubeId: null
			};
		}
		return column[y];
	}

	/**
	 * Returns the ID of the cube at the given location, or null if that cell is empty.
	 */
	getCubeId(p: [number, number]): number | null {
		return this.getCell(p).cubeId;
	}

	/**
	 * Returns the cube at the given location, or null if that cell is empty.
	 */
	getCube(p: [number, number]): Cube | null {
		const id = this.getCubeId(p);
		if (id === null) {
			return null;
		}
		return this.cubes[id];
	}

	/**
	 * Checks if a cube exists at the given location.
	 */
	hasCube(p: [number, number]): boolean {
		return !!this.getCube(p);
	}

	/**
	 * Adds a new cube of the given color at the given location; throws if a
	 * cube already exists at that location.
	 */
	addCube(p: [number, number], color: Color): Cube {
		const cube = this.addCubeUnmarked(p, color);
		this.markComponents();
		return cube;
	}

	/**
	 * As addCube(), but does not update the component status of the cubes.
	 */
	addCubeUnmarked(p: [number, number], color: Color): Cube {
		if (this.hasCube(p)) {
			throw new Error(`Tried to insert cube on top of another cube ` +
					`at (${p[0]}, ${p[1]})`);
		}
		const cube = new Cube(this, p, color);
		this.getCell(p).cubeId = this.cubes.length;
		this.cubes.push(cube);
		return cube;
	}

	/**
	 * Moves the cube from the given source location to the given target
	 * location. Throws if no cube exists at the source or if a cube already
	 * exists at the target.
	 */
	moveCube(from: [number, number], to: [number, number]): void {
		this.moveCubeUnmarked(from, to);
		this.markComponents();
	}

	/**
	 * As moveCube(), but does not update the component status of the cubes.
	 */
	moveCubeUnmarked(from: [number, number], to: [number, number]): void {
		if (!this.hasCube(from)) {
			throw new Error(`Tried to move non-existing cube at ` +
					`at (${from[0]}, ${from[1]})`);
		}

		if (this.hasCube(to)) {
			throw new Error(`Tried to move cube on top of another cube ` +
					`at (${to[0]}, ${to[1]})`);
		}

		const id = this.getCubeId(from)!;
		this.getCell(from).cubeId = null;
		this.getCell(to).cubeId = id;
		this.cubes[id].p = [to[0], to[1]];
	}

	/**
	 * Removes the cube at the given location; throws if no cube exists there.
	 */
	removeCube(p: [number, number]): void {
		this.removeCubeUnmarked(p);
		this.markComponents();
	}

	/**
	 * As removeCube(), but does not update the component status of the cubes.
	 */
	removeCubeUnmarked(p: [number, number]): void {
		if (!this.hasCube(p)) {
			throw new Error(`Tried to remove non-existing cube ` +
					`at (${p[0]}, ${p[1]})`);
		}
		const cube = this.getCube(p)!;
		this.getCell(p).cubeId = null;
		this.cubes = this.cubes.filter((b) => b !== cube);
		// because removing the cube from this.cubes changes the indices, we
		// need to update the cubeIds as well
		for (let i = 0; i < this.cubes.length; i++) {
			this.getCell(this.cubes[i].p).cubeId = i;
		}
	}

	/**
	 * Returns an object with keys 'N', 'NE', 'E', etc. with booleans
	 * indicating if the given cell has neighboring cubes in that direction.
	 */
	hasNeighbors(p: [number, number]): {[key: string]: boolean} {
		const [x, y] = p;
		let has: {[key: string]: boolean} = {};
		has['N'] = this.hasCube([x, y + 1]);
		has['NE'] = this.hasCube([x + 1, y + 1]);
		has['E'] = this.hasCube([x + 1, y]);
		has['SE'] = this.hasCube([x + 1, y - 1]);
		has['S'] = this.hasCube([x, y - 1]);
		has['SW'] = this.hasCube([x - 1, y - 1]);
		has['W'] = this.hasCube([x - 1, y]);
		has['NW'] = this.hasCube([x - 1, y + 1]);
		return has;
	}

	/**
	 * Given a cube, returns a list of all the moves starting at that cube that
	 * are valid.
	 *
	 * If the configuration would be disconnected without the given cube, no
	 * move is valid, so an empty array is returned.
	 */
	validMovesFrom(p: [number, number]): Move[] {
		let moves: Move[] = [];

		if (!this.isConnected(p)) {
			return [];
		}

		for (const direction of Object.keys(MoveDirection)) {
			const m = new Move(this, p, MoveDirection[<MoveDirection> direction]);
			if (m.isValidIgnoreConnectivity()) {
				// already checked connectivity before (yay, efficiency!)
				moves.push(m);
			}
		}

		return moves;
	}

	/**
	 * Returns a move from and to the given coordinates.
	 */
	getMoveTo(source: Cube, target: [number, number]): Move | null {
		const moves = this.validMovesFrom(source.p);
		for (let move of moves) {
			if (move.targetPosition()[0] === target[0] &&
					move.targetPosition()[1] === target[1]) {
				return move;
			}
		}
		return null;
	}

	/**
	 * Executes the shortest move path between the given cubes.
	 *
	 * Throws if no move path is possible.
	 *
	 * @param from The source coordinate, containing the cube we want to move.
	 * @param to The target coordinate, which should be an empty cell.
	 */
	*shortestMovePath(from: [number, number], to: [number, number]): Algorithm {
		
		// temporarily remove the origin cube from the configuration, to avoid
		// invalid moves in the resulting move path (because we could slide
		// along the origin cube itself)
		const cube = this.getCube(from);
		if (cube === null) {
			throw new Error("Cannot compute move path from non-existing cube" +
				` (${from[0]}, ${from[1]})`);
		}
		this.removeCubeUnmarked(from);

		// do BFS over the move graph
		let seen: {[key: string]: {'seen': boolean, 'move': Move | null}} = {};
		let queue: [[number, number], Move | null][] = [[from, null]];

		while (queue.length !== 0) {
			const location = queue.shift()!;
			if (seen[location[0][0] + "," + location[0][1]]) {
				continue;
			}
			seen[location[0][0] + "," + location[0][1]] = {
				'seen': true,
				'move': location[1]
			};
			if (location[0][0] === to[0] && location[0][1] === to[1]) {
				// done!
				break;
			}

			const moves = this.validMovesFrom(location[0]);
			moves.forEach(function(move) {
				queue.push([move.targetPosition(), move]);
			});
		}

		if (!seen[to[0] + "," + to[1]]) {
			const newCube = this.addCubeUnmarked(cube.p, cube.color);
			newCube.componentStatus = cube.componentStatus;
			throw new Error("No move path possible from " + from + " to " + to);
		}

		// reconstruct the path
		let path: Move[] = [];
		let c = to;
		while (c[0] !== from[0] || c[1] !== from[1]) {
			let move = seen[c[0] + "," + c[1]].move!;
			path.unshift(move);
			c = move.sourcePosition();
		}

		// put the origin cube back
		const newCube = this.addCubeUnmarked(cube.p, cube.color);
		newCube.componentStatus = cube.componentStatus;

		yield* path;
	}

	nextStep(algorithm: Algorithm, step: number): void {

		// first actually execute the current move
		if (this.currentMove) {
			this.currentMove.execute();
		} else {
			this.markComponents();
		}

		// now figure out the next move
		const output = algorithm.next();
		if (output.done) {
			this.currentMove = null;
			return;
		}
		if (!output.value.isValid()) {
			throw new Error("Invalid move detected: " + output.value.toString());
		}

		this.currentMove = output.value;
	}

	nextStepUnmarked(algorithm: Algorithm, step: number): void {

		// first actually execute the current move
		if (this.currentMove) {
			this.currentMove.executeUnmarked();
		}

		// now figure out the next move
		const output = algorithm.next();
		if (output.done) {
			this.currentMove = null;
			return;
		}
		if (!output.value.isValid()) {
			throw new Error("Invalid move detected: " + output.value.toString());
		}

		this.currentMove = output.value;
	}

	/**
	 * Returns the degree of the given cube (in 4-connectivity).
	 */
	degree(c: Cube): number {
		const has = this.hasNeighbors(c.p);
		let count = 0;
		if (has['N']) {
			count++;
		}
		if (has['E']) {
			count++;
		}
		if (has['S']) {
			count++;
		}
		if (has['W']) {
			count++;
		}
		return count;
	}

	/**
	 * Returns a neighbor of the given cube.
	 */
	getOneNeighbor(c: Cube): Cube | null {
		const [x, y] = c.p;
		let neighbor = this.getCube([x + 1, y]);
		if (neighbor) {
			return neighbor;
		}
		neighbor = this.getCube([x - 1, y]);
		if (neighbor) {
			return neighbor;
		}
		neighbor = this.getCube([x, y + 1]);
		if (neighbor) {
			return neighbor;
		}
		neighbor = this.getCube([x, y - 1]);
		if (neighbor) {
			return neighbor;
		}
		return null;
	}

	/**
	 * Returns all neighbors of the given grid coordinate.
	 */
	getNeighbors([x, y]: [number, number]): Cube[] {
		let neighbors = [];
		let neighbor = this.getCube([x + 1, y]);
		if (neighbor) {
			neighbors.push(neighbor);
		}
		neighbor = this.getCube([x - 1, y]);
		if (neighbor) {
			neighbors.push(neighbor);
		}
		neighbor = this.getCube([x, y + 1]);
		if (neighbor) {
			neighbors.push(neighbor);
		}
		neighbor = this.getCube([x, y - 1]);
		if (neighbor) {
			neighbors.push(neighbor);
		}
		return neighbors;
	}

	/**
	 * Returns all neighbors of the given grid coordinate, as a dictionary
	 * mapping compass directions to Cubes.
	 */
	getNeighborMap([x, y]: [number, number]): {[direction: string]: Cube | null} {
		let neighbors: {[direction: string]: Cube | null} = {};
		neighbors['N'] = this.getCube([x, y + 1]);
		neighbors['E'] = this.getCube([x + 1, y]);
		neighbors['W'] = this.getCube([x - 1, y]);
		neighbors['S'] = this.getCube([x, y - 1]);
		neighbors['NE'] = this.getCube([x + 1, y + 1]);
		neighbors['NW'] = this.getCube([x - 1, y + 1]);
		neighbors['SW'] = this.getCube([x - 1, y - 1]);
		neighbors['SE'] = this.getCube([x + 1, y - 1]);
		return neighbors;
	}

	/**
	 * Puts all cubes back in their starting location.
	 */
	reset(): void {
		this.cubes.forEach((cube) => {
			this.getCell(cube.p).cubeId = null;
		});
		for (let i = 0; i < this.cubes.length; i++) {
			const cube = this.cubes[i];
			cube.p = [cube.resetPosition[0], cube.resetPosition[1]];
			this.getCell(cube.p).cubeId = i;
		}
		this.markComponents();
	}

	/**
	 * Checks if the configuration is connected. If the skip parameter is
	 * provided, that cube is ignored (considered as non-existing).
	 */
	isConnected(skip?: [number, number]): boolean {
		if (!this.cubes.length) {
			return true;
		}

		// do BFS from cube 0 to check if we can reach all cubes
		let seen = Array(this.cubes.length).fill(false);
		let seenCount = 0;
		let queue = [0];

		if (skip) {
			// mark the skipped cube so we won't visit it again
			const skipIndex = this.getCubeId(skip);
			if (skipIndex !== null) {
				seen[skipIndex] = true;
				seenCount++;

				// special case: if we were about to start our BFS with the
				// skipped cube, then pick another cube to start with
				// (note that if the configuration has exactly 1 cube, which
				// is then skipped, the function should return true
				// but that works because the BFS starting at the skipped
				// cube will not encounter any cubes)
				if (skipIndex === 0 && this.cubes.length > 1) {
					queue = [1];
				}
			}
		}

		while (queue.length !== 0) {
			const cubeId = queue.shift()!;
			if (seen[cubeId]) {
				continue;
			}
			
			const cube = this.cubes[cubeId];
			seen[cubeId] = true;
			seenCount++;

			const neighbors = [
				this.getCell([cube.p[0] - 1, cube.p[1]]),
				this.getCell([cube.p[0] + 1, cube.p[1]]),
				this.getCell([cube.p[0], cube.p[1] - 1]),
				this.getCell([cube.p[0], cube.p[1] + 1])
			];
			neighbors.forEach(function(c) {
				if (c.cubeId) {
					queue.push(c.cubeId);
				}
			});
		}

		return this.cubes.length === seenCount;
	}

	/**
	 * Returns the minimum and maximum x- and y-coordinates of cubes in the
	 * configuration, as an array [minX, minY, maxX, maxY].
	 */
	bounds(): [number, number, number, number] {
		return [
			this.cubes.map((cube) => cube.p[0]).min(),
			this.cubes.map((cube) => cube.p[1]).min(),
			this.cubes.map((cube) => cube.p[0]).max(),
			this.cubes.map((cube) => cube.p[1]).max()
		];
	}

	/**
	 * Returns the bridge limit L.
	 */
	bridgeLimit(): number {
		const bounds = this.bounds();
		const width = bounds[2] - bounds[0] + 1;
		const height = bounds[3] - bounds[1] + 1;
		return 2 * (width + height);
	}

	/**
	 * Returns the leftmost cube in the downmost row that contains cubes.
	 */
	downmostLeftmost(): Cube | null {
		if (!this.cubes.length) {
			return null;
		}

		const lowestY = this.cubes
			.map((cube) => cube.p[1])
			.min();

		const lowestX = this.cubes
			.filter((cube) => cube.p[1] === lowestY)
			.map((cube) => cube.p[0])
			.min();

		return this.getCube([lowestX, lowestY]);
	}

	/**
	 * Colors the cubes by their connectivity, and set their connectivity
	 * fields.
	 */
	markComponents(): void {
		const [components, chunkIds] = this.findComponents();
		const stable = this.findCubeStability();
		for (let i = 0; i < this.cubes.length; i++) {
			if (components[i] === 2) {
				this.cubes[i].setComponentStatus(stable[i] ? ComponentStatus.CHUNK_STABLE : ComponentStatus.CHUNK_CUT);
			} else if (components[i] === 1) {
				this.cubes[i].setComponentStatus(stable[i] ? ComponentStatus.LINK_STABLE : ComponentStatus.LINK_CUT);
			} else if (components[i] === 3) {
				this.cubes[i].setComponentStatus(ComponentStatus.CONNECTOR);
			} else {
				this.cubes[i].setComponentStatus(ComponentStatus.NONE);
			}
			this.cubes[i].setChunkId(chunkIds[i]);
		}

		for (const c of this.cubes) {
			c.onBoundary = false;
		}

		for (const c of this.outsideCubes()) {
			c.onBoundary = true;
		}
	}

	/**
	 * Returns a list of component values for each cube.
	 *
	 * This returns two arrays. The first array indicates for each cube the
	 * component status: 1 and 2 mean that the cube is in a link or chunk,
	 * respectively, while 3 means that the cube is a connector (that is, in
	 * more than one component). The second array contains the ID of the chunk
	 * the cube is in. If the cube is a connector and in more than one chunk,
	 * the chunk ID of the chunk closer to the root is returned. Cubes that
	 * are not in a chunk get chunk ID -1.
	 *
	 * If the configuration is disconneted, this returns -1 for both component
	 * status and chunk IDs.
	 */
	findComponents(): [number[], number[]] {

		let components = Array(this.cubes.length).fill(-1);
		let chunkIds = Array(this.cubes.length).fill(-1);

		// don't try to find components if the configuration is disconnected
		if (!this.cubes.length || !this.isConnected()) {
			return [components, chunkIds];
		}

		let seen = Array(this.cubes.length).fill(false);
		const outside = this.outsideCubes();
		let stack = [];
		let chunksSeen = 0;

		// walk over the outside
		for (let i = 0; i < outside.length; i++) {
			const cube = outside[i];
			const cubeId = this.getCubeId(cube.p)!;

			// if we've not seen this cube, put it on the stack
			// else mark its component and pop it
			if (!seen[cubeId]) {
				seen[cubeId] = true;
				stack.push(cubeId);
			} else if (stack.length >= 1 && stack[stack.length - 2] === cubeId) {
				const cId = stack.pop()!;
				if (components[cId] === -1) {
					components[cId] = 1;
				}
				if (components[cubeId] === -1) {
					components[cubeId] = 1;
				}
			} else {
				// pop entire 2-component in one go
				while (stack.length > 1 && stack[stack.length - 1] !== cubeId) {
					const cId = stack.pop()!;
					components[cId] = components[cId] !== -1 ? 3 : 2;
					chunkIds[cId] = chunksSeen;
				}
				// mark attachment point as cross (except if stack is empty)
				const cId = stack[stack.length - 1];
				components[cId] = stack.length > 1 ? 3 : 2;
				chunkIds[cId] = chunksSeen;
				chunksSeen++;
			}
		}

		// if origin wasn't put in a component yet, it needs to be a
		// 1-component
		const originId = this.getCubeId(outside[0].p)!;
		if (components[originId] === -1) {
			components[originId] = 1;
		}

		// and all remaining cubes not in a component need to be on the inside
		// of a 2-component
		for (let i = 0; i < components.length; i++) {
			if (components[i] === -1) {
				components[i] = 2;
			}
		}

		// mark loose squares as part of a chunk
		for (let i = 0; i < components.length; i++) {
			if (components[i] === 1 &&
					this.degree(this.cubes[i]) === 1) {
				const neighbor = this.getOneNeighbor(this.cubes[i])!;
				const neighborIndex = this.getCubeId(neighbor.p)!;
				if (components[neighborIndex] === 3) {
					components[i] = 2;
					chunkIds[i] = chunkIds[neighborIndex];
					const [x, y] = neighbor.p;
					let cs = [
						this.getCube([x - 1, y]),
						this.getCube([x + 1, y]),
						this.getCube([x, y - 1]),
						this.getCube([x, y + 1])
					];
					let shouldRemoveConnector = true;
					for (let c of cs) {
						if (c) {
							if (components[this.getCubeId(c.p)!] === 1) {
								shouldRemoveConnector = false;
							}
						}
					}
					if (shouldRemoveConnector) {
						components[this.getCubeId(neighbor.p)!] = 2;
					}
				}
			}
		}

		return [components, chunkIds];
	}

	/**
	 * Determines which cubes in the configuration are stable.
	 *
	 * Returns a list of booleans for each cube: true if the corresponding cube
	 * is stable; false if it is a cut cube.
	 */
	findCubeStability(): boolean[] {
		if (!this.cubes.length) {
			return [];
		}
		let seen = Array(this.cubes.length).fill(false);
		let parent: (number | null)[] = Array(this.cubes.length).fill(null);
		let depth = Array(this.cubes.length).fill(-1);
		let low = Array(this.cubes.length).fill(-1);
		let stable = Array(this.cubes.length).fill(true);
		this.findCubeStabilityRecursive(0, 0, seen, parent, depth, low, stable);
		return stable;
	}

	private findCubeStabilityRecursive(i: number, d: number,
			seen: boolean[], parent: (number | null)[],
			depth: number[], low: number[],
			stable: boolean[]): void {

		seen[i] = true;
		depth[i] = d;
		low[i] = d;
		let cube = this.cubes[i];

		const neighbors = [
			this.getCell([cube.p[0] - 1, cube.p[1]]),
			this.getCell([cube.p[0] + 1, cube.p[1]]),
			this.getCell([cube.p[0], cube.p[1] - 1]),
			this.getCell([cube.p[0], cube.p[1] + 1])
		];
		const self = this;
		let cutCube = false;
		let childCount = 0;
		neighbors.forEach(function(c) {
			if (c.cubeId !== null && !seen[c.cubeId]) {
				parent[c.cubeId] = i;
				self.findCubeStabilityRecursive(c.cubeId, d + 1,
						seen, parent, depth, low, stable);
				childCount++;
				if (low[c.cubeId] >= depth[i]) {
					cutCube = true;
				}
				low[i] = Math.min(low[i], low[c.cubeId]);
			} else if (c.cubeId !== null && c.cubeId != parent[i]) {
				low[i] = Math.min(low[i], depth[c.cubeId]);
			}
		});
		if (parent[i] === null) {
			stable[i] = childCount <= 1;
		} else {
			stable[i] = !cutCube;
		}
	}

	/**
	 * Returns a list of cubes on the outside of the configuration, in
	 * counter-clockwise order, starting with the downmost-leftmost cube.
	 * The downmost-leftmost cube is included twice (both as the first and as
	 * the last element in the list).
	 */
	outsideCubes(): Cube[] {
		if (!this.cubes.length) {
			return [];
		}
		const start = this.downmostLeftmost()!;
		let outside: Cube[] = [];
		let edgesSeen = new Set();
		let position: [number, number] = [start.p[0], start.p[1]];
		let direction: string | null = 'S';
		while (true) {
			let cube = this.getCube(position)!;
			outside.push(cube);
			direction = this.nextOnOutside(position, direction);
			if (!direction) {
				break;
			}
			let newEdge = cube.p[0] + " " + cube.p[1] + " " + direction;
			if (edgesSeen.has(newEdge)) {
				break;
			}
			edgesSeen.add(newEdge);
			switch (direction) {
				case 'N':
					position[1]++;
					break;
				case 'E':
					position[0]++;
					break;
				case 'S':
					position[1]--;
					break;
				case 'W':
					position[0]--;
					break;
			}
		}
		return outside;
	}

	/**
	 * Given a position and the direction of the previous segment of the
	 * outside, returns the direction of the next outside segment.
	 */
	private nextOnOutside(p: [number, number], direction: string): string | null {
		const has = this.hasNeighbors(p);
		const bends: {[key: string]: string[]} = {
			'N': ['E', 'N', 'W', 'S'],
			'E': ['S', 'E', 'N', 'W'],
			'S': ['W', 'S', 'E', 'N'],
			'W': ['N', 'W', 'S', 'E'],
		};
		for (let i = 0; i < 4; i++) {
			const dir = bends[direction][i];
			if (has[dir]) {
				return dir;
			}
		}
		return null;
	}

	/**
	 * Given a cube, determines the number of cubes in its descendant(s).
	 */
	bridgeCapacity(b: Cube): number {

		// do a BFS from the root, but ignore b
		let seen = Array(this.cubes.length).fill(false);
		const bId = this.getCubeId(b.p)!;
		seen[bId] = true;
		let cubeCount = 1;

		const originId = this.getCubeId(this.downmostLeftmost()!.p);
		let queue = [originId];

		while (queue.length !== 0) {
			const cubeId = queue.shift()!;
			if (seen[cubeId]) {
				continue;
			}

			const cube = this.cubes[cubeId];
			seen[cubeId] = true;
			if (bId !== cubeId) {
				cubeCount++;
			}

			const neighbors = [
				this.getCell([cube.p[0] - 1, cube.p[1]]),
				this.getCell([cube.p[0] + 1, cube.p[1]]),
				this.getCell([cube.p[0], cube.p[1] - 1]),
				this.getCell([cube.p[0], cube.p[1] + 1])
			];
			neighbors.forEach(function(c) {
				if (c.cubeId !== null) {
					queue.push(c.cubeId);
				}
			});
		}

		return this.cubes.length - cubeCount;
	}

	/**
	 * Determines if the configuration is xy-monotone.
	 */
	isXYMonotone(): boolean {
		const [minX, minY, , ] = this.bounds();

		for (const cube of this.cubes) {
			if (cube.p[0] === minX || cube.p[1] === minY) {
				continue;
			}
			if (!this.hasCube([cube.p[0], cube.p[1] - 1])) {
				return false;
			}
			if (!this.hasCube([cube.p[0] - 1, cube.p[1]])) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Generates a JSON string from this world.
	 */
	serialize(): string {
		let cubes: any = [];
		this.cubes.forEach((cube) => {
			cubes.push({
				'x': cube.resetPosition[0],
				'y': cube.resetPosition[1],
				'color': [cube.color.r, cube.color.g, cube.color.b]
			});
		});
		let obj: any = {
			'_version': 1,
			'cubes': cubes
		};
		return JSON.stringify(obj);
	}

	/**
	 * Parses a JSON string back into this world. Make sure this is an empty
	 * world before calling this method.
	 */
	deserialize(data: string): void {
		let obj: any = JSON.parse(data);

		if (obj['_version'] > 1) {
			throw new Error('Save file with incorrect version');
		}

		let cubes: any[] = obj['cubes'];
		cubes.forEach((cube: any) => {
			let color = Color.BLUE;
			if (cube.hasOwnProperty('color')) {
				color = new Color(cube['color'][0],
					cube['color'][1], cube['color'][2]);
			}
			this.addCube([cube['x'], cube['y']], color);
		});
	}

	/**
	 * Generates an Ipe drawing from this world.
	 */
	toIpe(): string {
		let header = '<ipeselection pos="0 0">\n';
		let footer = '</ipeselection>\n';

		let elements = '';

		// shadows
		this.cubes.forEach((cube) => {
			let x = 8 * cube.p[0];
			let y = 8 * cube.p[1];
			elements += `<path stroke="Gray 0.7" fill="Gray 0.7" pen="heavier" cap="1" join="1">
${x + 8} ${y + 8} m
${x + 9} ${y + 7} l
${x + 9} ${y - 1} l
${x + 1} ${y - 1} l
${x} ${y} l
${x + 8} ${y} l
h
</path>\n`;
		});

		// cubes
		this.cubes.forEach((cube) => {
			let x = 8 * cube.p[0];
			let y = 8 * cube.p[1];
			elements += `<path stroke="black" fill="Gray 0.9" pen="heavier" cap="1" join="1">
${x} ${y + 8} m
${x} ${y} l
${x + 8} ${y} l
${x + 8} ${y + 8} l
h
</path>\n`;

			switch (cube.componentStatus) {
				case ComponentStatus.CHUNK_STABLE:
					elements += `<use layer="cubes" name="mark/square(sx)" pos="${x + 4} ${y + 4}" size="normal" stroke="Bettina blue"/>\n`;
					break;
				case ComponentStatus.LINK_STABLE:
					elements += `<use layer="cubes" name="mark/disk(sx)" pos="${x + 4} ${y + 4}" size="normal" stroke="Bettina red"/>\n`;
					break;
				case ComponentStatus.CHUNK_CUT:
					elements += `<use layer="cubes" name="mark/box(sx)" pos="${x + 4} ${y + 4}" size="normal" stroke="Bettina blue"/>\n`;
					break;
				case ComponentStatus.LINK_CUT:
					elements += `<use layer="cubes" name="mark/circle(sx)" pos="${x + 4} ${y + 4}" size="normal" stroke="Bettina red"/>\n`;
					break;
				case ComponentStatus.CONNECTOR:
					elements += `<use layer="cubes" name="mark/box(sx)" pos="${x + 4} ${y + 4}" size="normal" stroke="Bettina blue"/>\n`;
					elements += `<use layer="cubes" name="mark/cross(sx)" pos="${x + 4} ${y + 4}" size="normal" stroke="Bettina blue"/>\n`;
					break;
			}
		});
		
		//return header + elements + footer;
		return elements;
	}
}

export {Algorithm, World, Move, MoveDirection};

