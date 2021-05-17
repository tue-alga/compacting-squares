import {World, Move} from './world';

type Position = [number, number];

class Color {
	static readonly GRAY = new Color(230, 230, 230);
	static readonly BLUE = new Color(68, 187, 248);
	static readonly RED = new Color(248, 78, 94);
	static readonly YELLOW = new Color(248, 230, 110);
	static readonly PURPLE = new Color(200, 90, 220);
	static readonly ORANGE = new Color(248, 160, 80);
	static readonly GREEN = new Color(140, 218, 90);

	constructor(public r: number, public g: number, public b: number) {
	}

	toHexColor(): number {
		return (this.r << 16) | (this.g << 8) | this.b;
	}

	equals(other: Color): boolean {
		return this.r === other.r &&
				this.g === other.g &&
				this.b === other.b;
	}
}

enum ComponentStatus {
	LINK_CUT, LINK_STABLE, CHUNK_CUT, CHUNK_STABLE, CONNECTOR, NONE
}

class Cube {
	p: Position;
	resetPosition: Position;
	color: Color;
	componentStatus: ComponentStatus;
	chunkId: number;
	onBoundary: boolean = false;
	selected: boolean = false;

	constructor(private world: World, p: [number, number], color: Color) {
		this.p = [p[0], p[1]];
		this.resetPosition = [p[0], p[1]];
		this.color = color;
		this.componentStatus = ComponentStatus.NONE;
		this.chunkId = -1;
	}

	setColor(color: Color): void {
		this.color = color;
	}

	setComponentStatus(componentStatus: ComponentStatus): void {
		this.componentStatus = componentStatus;
	}

	setChunkId(chunkId: number): void {
		this.chunkId = chunkId;
	}

	nextColor(): void {
		if (this.color.equals(Color.GRAY)) {
			this.setColor(Color.BLUE);
		} else if (this.color.equals(Color.BLUE)) {
			this.setColor(Color.RED);
		} else if (this.color.equals(Color.RED)) {
			this.setColor(Color.YELLOW);
		} else if (this.color.equals(Color.YELLOW)) {
			this.setColor(Color.PURPLE);
		} else if (this.color.equals(Color.PURPLE)) {
			this.setColor(Color.ORANGE);
		} else if (this.color.equals(Color.ORANGE)) {
			this.setColor(Color.GREEN);
		} else {
			this.setColor(Color.GRAY);
		}
	}
}

export {Cube, Color, ComponentStatus, Position};

