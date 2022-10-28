interface Mouse {
    down: boolean,
    pos: Vec2,
    delta: Vec2,
}
type PartialMouse = { [e in keyof Mouse]?: Mouse[e] };

const mouse: Mouse = { down: false, pos: new Vec2(0, 0), delta: new Vec2(0, 0) };
let first_mouse = true;

const events: { [e in keyof DocumentEventMap]?: ((this: Document, ev: DocumentEventMap[e]) => any)[] } = {};

function listenDoc<K extends keyof DocumentEventMap>(type: K, listener: (this: Document, ev: DocumentEventMap[K]) => any) {
    document.addEventListener(type, e => {
        listener.bind(document)(e);

        for (const l of events[type] ?? []) {
            l.bind(document)(e);
        }
    });
}

function listen<K extends keyof DocumentEventMap>(type: K, listener: (this: Document, ev: DocumentEventMap[K]) => any) {
    const a = events[type];
    if (a) {
        a.push(listener);
    } else {
        /// @ts-ignore
        events[type] = [listener];
    }
}

function mouseUpdate(partial: PartialMouse) {
    if (first_mouse) {
        first_mouse = false;
        // unset delta since its wrong on the first event
        partial.delta = undefined;
    }


    for (const key in partial) {
        /// @ts-ignore
        mouse[key] = partial[key];
    }
}

listenDoc("mousedown", e => {
    const pos = new Vec2(e.x, e.y);
    mouseUpdate({
        down: true,
        pos,
        delta: pos.sub(mouse.pos)
    });
});

listenDoc("mouseup", e => {
    const pos = new Vec2(e.x, e.y);
    mouseUpdate({
        down: false,
        pos,
        delta: pos.sub(mouse.pos)
    });
});

listenDoc("mousemove", e => {
    const pos = new Vec2(e.x, e.y);
    mouseUpdate({
        pos,
        delta: pos.sub(mouse.pos)
    });
});

const rowCode = {
    zero_code: "a".charCodeAt(0),
    max_code: "z".charCodeAt(0),
    max: "z".charCodeAt(0) - "a".charCodeAt(0),
    min: 0,
};

interface Row {
    size: number,
    removed: number,
}

function sleep(dur: number): Promise<void> {
    return new Promise(res => setTimeout(res, dur));
}

function waitAnimationFrame(): Promise<void> {
    return new Promise(res => requestAnimationFrame(() => res()));
}

class Game {
    state: Row[];
    dom: HTMLDivElement;
    generation: number;
    can_move: boolean;

    static instances: number = 0;
    constructor(state: number[]) {
        if (Game.instances > 0) {
            throw new Error("Multiple instances of Game");
        }

        this.state = state.map(size => ({ size, removed: 0 }));
        this.dom = document.getElementById("game") as HTMLDivElement;
        this.generation = 0;
        this.can_move = true;

        Game.instances++;

        const that = this;
        document.querySelector("#submit")?.addEventListener("click", () => {
            if(that.can_move && that.state.map(v => v.removed).reduce((a, b) => a + b) > 0) {
                that.submit();
            }
        });
    }

    static parseRow(row: string): number {
        const code = row.charCodeAt(0);

        if (code < rowCode.zero_code || code > rowCode.max_code) {
            throw new Error(`Can't parse row '${row}'`);
        }

        return code - rowCode.zero_code;
    }

    static encodeRow(row: number): string {
        if (row < rowCode.min || row > rowCode.max) {
            throw new Error(`Can't encode invalid row ${row}`);
        }

        return String.fromCharCode(row + rowCode.zero_code);
    }

    static parseMove(move: string): [number, number] {
        return [Game.parseRow(move[0]), parseInt(move.slice(1))];
    }

    static encodeMove(move: [number, number]): string {
        return `${Game.encodeRow(move[0])}${move[1]}`;
    }

    updateDom() {
        const rows = Array.from(this.dom.children);

        const row_delta = this.state.length - rows.length;
        if (row_delta < 0) {
            rows.splice(row_delta).forEach(el => el.remove());
        } else if (row_delta > 0) {
            for (let i = 0; i < row_delta; i++) {
                const child = document.createElement("div");
                child.classList.add("row");
                this.dom.appendChild(child);
                rows.push(child);
            }
        }

        for (let i = 0; i < this.state.length; i++) {
            const row = this.state[i];
            const row_el = rows[i];

            const bars = Array.from(row_el.children);
            const delta = row.size - bars.length;

            if (delta < 0) {
                bars.splice(delta).forEach(el => el.remove());
            } else if (delta > 0) {
                for (let j = 0; j < delta; j++) {
                    const bar = document.createElement("div");
                    bar.innerText = "I";
                    bar.classList.add("bar");
                    if (delta - j < row.removed) {
                        bar.classList.add("greyed");
                    }
                    row_el.appendChild(bar);
                    bars.push(bar);

                    const that = this;
                    bar.addEventListener("mousedown", event => {
                        if(!that.can_move) return;

                        const el = event.target as HTMLDivElement;
                        const row_el = el.parentElement as HTMLDivElement;
                        const index = Array.from(row_el.children).indexOf(el);
                        const row_index = Array.from(that.dom.children).indexOf(row_el);
                        const rem = this.state[row_index].size - index;

                        that.onMove([row_index, rem]);
                    });
                }
            }

            for (let j = 0; j < row.size; j++) {
                if (row.size - j < row.removed) {
                    bars[j].classList.add("greyed");
                } else {
                    bars[j].classList.remove("greyed");
                }
            }
        }
    }

    private async onMove(move: [number, number]) {
        const [row_index] = move;
        const row = this.state[row_index];
        const index = row.size - move[1];
        const row_el = this.dom.children[row_index];

        this.state.forEach(v => v.removed = 0);
        row.removed = row.size - index;
        const gen = ++this.generation;

        Array.from(this.dom.children).forEach((el, r) => {
            Array.from(el.children).forEach((el, b) => {
                (r != row_index || b < index) && el.classList.remove("greyed")
            });
        });

        for (let i = index; i < row.size; i++) {
            row_el.children[i].classList.add("greyed");
            await sleep(50);

            // Stop animation if another one is scheduled
            if (this.generation != gen) {
                break;
            }
        }
    }

    async submit() {
        const to_remove: Element[] = [];
        for (let y = 0; y < this.state.length; y++) {
            const row = this.state[y];
            const row_el = this.dom.children[y];
            for (let x = row.size - row.removed; x < row.size; x++) {
                const bar = row_el.children[x];
                bar.classList.add("hidden");
                to_remove.push(bar);
                await sleep(50);
            }

            row.size -= row.removed;
            row.removed = 0;
        }

        await sleep(50 * to_remove.length);

        to_remove.forEach(el => {
            el.innerHTML = "";
            el.classList.add("squished");
        });

        await sleep(200);

        to_remove.forEach(el => el.remove())

        let top = this.dom.getBoundingClientRect().y;

        let rows = Array.from(this.dom.children)
            .map((el, i) => ({
                el: el as HTMLElement,
                size: this.state[i].size,
                index: i,
                offset: el.getBoundingClientRect().y - top,
            }));
        rows.sort((a, b) => a.size - b.size);

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            this.dom.insertBefore(r.el, this.dom.children[i]);
            const new_offset = r.el.getBoundingClientRect().y - top;
            const delta = r.offset - new_offset;
            r.el.style.transition = "none";
            r.el.style.transform = `translateY(${delta}px)`;
        }

        await waitAnimationFrame();
        await waitAnimationFrame();

        for (const r of rows) {
            r.el.style.transform = "";
            r.el.style.transition = "";
        }

        if (rows[0].size == 0) {
            rows[0].el.classList.add("squished");
        }

        await sleep(200);

        this.state.sort((a, b) => a.size - b.size);

        if (rows[0].size == 0) {
            rows[0].el.remove();
            this.state.shift();
        }

        this.updateDom()

        this.can_move = !this.can_move;

        if(!this.can_move) {
            await sleep(500);
            this.respond();

            if(this.state.length == 0) {
                this.end(true);
            }
        }
    }

    async respond() {
        const sum = await waitForLoad();

        const key = this.state.map(v => v.size.toString()).join(":");
        const res = sum.data[key];

        let move: [number, number];
        if (res == null) {
            const row = Math.floor(Math.random() * this.state.length);
            const rem = Math.floor(Math.random() * (this.state[row].size)) + 1;
            
            move = [row, rem];
        } else {
            move = Game.parseMove(res);
        }

        await this.onMove(move);

        await sleep(500);

        await this.submit();

        this.can_move = true;

        if(this.state.length == 0) {
            this.can_move = false;
            this.end(false);
        }
    }

    async end(won: boolean) {
        const sum = document.createElement("div") as HTMLDivElement;
        sum.id = "summary";
        sum.innerText = won ? "You won !" : "You lost";
        sum.classList.add("squished");

        this.dom.appendChild(sum);
        await waitAnimationFrame();
        await waitAnimationFrame();
        await waitAnimationFrame();
        sum.classList.remove("squished");

        const sub = document.querySelector("#submit") as HTMLDivElement;
        sub.id = "restart";
        sub.innerText = "Restart"
        sub.addEventListener("click", () => {
            location.reload();
        });
    }
}

const sumWaiter: ((_: any) => any)[] = [];
interface Sum {
    meta: {
        max_length: number,
        max_height: number,
    },
    data: {
        [e: string]: string | null
    }
}

let sum: Sum | undefined;
(async () => {
    const res = await fetch("sum.json");
    const json = await res.json();
    sumWaiter.forEach(res => res(json));
    sum = json;
})();

function waitForLoad(): Promise<Sum> {
    return new Promise(res => {
        if (sum) {
            res(sum);
        } else {
            sumWaiter.push(res);
        }
    });
}

(async () => {
const loc = new URL(location.href);
const arg = loc.searchParams.get("g");
let size = [1, 3, 5, 7];

if(arg && arg.match(/^[1-9][0-9]*(?::[1-9][0-9]*)+$/)) {
    size = arg.split(":").map(v => parseInt(v));
}

const game = new Game(size);
game.updateDom();

waitForLoad().then(sum => {
    if(size.some(s => s > sum.meta.max_length) || size.length > sum.meta.max_height) {
        game.dom.innerHTML = '<div id="summary">Invalid Game (too big)</div>';
    }
});
})();
