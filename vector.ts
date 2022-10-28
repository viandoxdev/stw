class Vec2 {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    dot(other: Vec2): number {
        return this.x * other.x + this.y * other.y;
    }

    squared_length(): number {
        return this.dot(this);
    }

    len(): number {
        return Math.sqrt(this.squared_length());
    }

    normalize(): Vec2 {
        const il = 1.0 / this.len();
        return new Vec2(this.x * il, this.y * il);
    }

    mul(other: number): Vec2;
    mul(other: Vec2): Vec2;
    mul(other: Vec2 | number): Vec2 {
        if (typeof other === "number") {
            return new Vec2(
                this.x * other,
                this.y * other,
            );
        } else {
            return new Vec2(
                this.x * other.x,
                this.y * other.y,
            );
        }
    }

    add(other: Vec2): Vec2 {
        return new Vec2(
            this.x + other.x,
            this.y + other.y,
        );
    }


    sub(other: Vec2): Vec2 {
        return new Vec2(
            this.x - other.x,
            this.y - other.y,
        );
    }

    clone(): Vec2 {
        return new Vec2(this.x, this.y);
    }
}
