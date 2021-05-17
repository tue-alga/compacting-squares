import {Algorithm, Move, World} from '../world';

class CustomAlgorithm {

	constructor(public world: World, public moveJson: string) {}

	*execute(): Algorithm {
		const sequence: any = JSON.parse(this.moveJson);
		const bounds = this.world.bounds();

		for (let i = 0; i < sequence['movepaths'].length; i++) {
			const a = sequence['movepaths'][i];
			printMiniStep(`Running move path ${i}`);
			let c = this.world.getCube(this.convert(a[0], bounds));
			if (!c) {
				throw "Custom move path tried to move a non-existing cube at " +
						this.convert(a[0], bounds);
			}
			let cube = c;
			for (let i = 1; i < a.length; i++) {
				const m = this.world.getMoveTo(cube, this.convert(a[i], bounds));
				if (m !== null && m.isValid()) {
					yield m;
				} else {
					// because of bugs in the original implementation, it may return
					// invalid moves; try to fix that by just taking the shortest
					// move path
					try {
						yield* this.world.shortestMovePath(
							cube.p, this.convert(a[i], bounds));
					} catch (e) {
						// there are even cases where the destination of the move
						// would disconnect the configuration, hence no move path
						// exists at all
						// in that case, skip this point in the list entirely
						continue;
					}
				}
				let c = this.world.getCube(this.convert(a[i], bounds));
				if (!c) {
					throw "Custom move path tried to move a non-existing cube at " +
							this.convert(a[i], bounds);
				}
				cube = c;
			}
		}
	}

	private convert(c: [number, number],
			bounds: [number, number, number, number]): [number, number] {
		const [minX, minY, maxX, maxY] = bounds;
		return [c[1] - minX - 1, maxX - c[0] - minY + 1];
	}
}

export {CustomAlgorithm};

