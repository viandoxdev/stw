const svg = document.getElementById("overlay") as unknown as SVGElement;
const path = document.getElementById("path") as unknown as SVGPathElement;

let points: Vec2[] = [];
let stroke_opacity = 0.0;
let mouse_interval = 0;

function setStrokeOpacity(o: number) {
    stroke_opacity = o;
    path.style.strokeOpacity = stroke_opacity.toString();
}

function updateSvgViewBox(width: number, height: number) {
    svg.setAttributeNS("http://www.w3.org/2000/svg", "viewBox", `0 0 ${width} ${height}`);
}

const SMOOTH = 0.2;
function renderPoints() {
    let dstring;
    const m = mouse.pos.clone();

    if(points.length == 0) {
        path.removeAttribute("d");
        return
    } else if(points.length == 1) {
        const p = points[0];
        dstring = `M ${p.x} ${p.y} L ${m.x} ${m.y}`;

        path.setAttribute("d", dstring);
    } else {
        const pts = [...points, m];
        const [p1, p2, p3] = pts;
        const ctrs = p2.add(p1.sub(p3).mul(SMOOTH));
        dstring = `M ${p1.x} ${p1.y} C ${ctrs.x} ${ctrs.y}, ${p2.x} ${p2.y}, ${p2.x} ${p2.y}`;

        for(let i = 1; i < pts.length - 2; i ++) {
            const bs = pts[i - 1];
            const s = pts[i];
            const e = pts[i + 1];
            const ae = pts[i + 2];

            const ctr1 = s.add(e.sub(bs).mul(SMOOTH));
            const ctr2 = e.add(s.sub(ae).mul(SMOOTH));

            dstring += ` C ${ctr1.x} ${ctr1.y}, ${ctr2.x} ${ctr2.y}, ${e.x} ${e.y}`;
        }

        let i = pts.length - 2;
        const bs = pts[i - 1];
        const s = pts[i];
        const e = pts[i + 1];

        const ctre = s.add(s.sub(bs).mul(SMOOTH));
        dstring += ` C ${ctre.x} ${ctre.y}, ${e.x} ${e.y}, ${e.x} ${e.y}`;

        path.setAttribute("d", dstring);
    }
}


listen("mousedown", () => {
    points = [mouse.pos.clone()];
    setStrokeOpacity(1);

    renderPoints();
    mouse_interval = setInterval(() => {
        points.push(mouse.pos.clone());
    }, 20);
});

listen("mouseup", () => {
    clearInterval(mouse_interval);
});

listen("mousemove", () => {
    if (mouse.down) {
        renderPoints();
    }
})

updateSvgViewBox(window.innerWidth, window.innerHeight);

window.addEventListener("resize", () => {
    updateSvgViewBox(window.innerWidth, window.innerHeight);
});

setInterval(() => {
    if(mouse.down) {
        return;
    }

    stroke_opacity *= 0.8;
    if(stroke_opacity <= 0.01) {
        stroke_opacity = 0;
        points = [];
        renderPoints();
    }
    path.style.strokeOpacity = stroke_opacity.toString();
}, 20);
