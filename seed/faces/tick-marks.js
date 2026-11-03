// Tick marks with a sweeping second hand and a colored hour and minute hand.
function setup() {
	createCanvas(face.size, face.size)
}

function draw() {
	background(10, 12, 30)
	translate(face.radius, face.radius)

	for (let i = 0; i < 60; i++) {
		const a = (i / 60) * TWO_PI
		const big = i % 5 === 0
		stroke(big ? 255 : 120)
		strokeWeight(big ? 6 : 2)
		const r1 = face.radius * (big ? 0.82 : 0.9)
		const r2 = face.radius * 0.96
		line(Math.sin(a) * r1, -Math.cos(a) * r1, Math.sin(a) * r2, -Math.cos(a) * r2)
	}

	strokeCap(ROUND)
	push(); rotate(face.hourAngle);   stroke(255, 200, 80);  strokeWeight(14); line(0, 0, 0, -face.radius * 0.45); pop()
	push(); rotate(face.minuteAngle); stroke(120, 220, 255); strokeWeight(8);  line(0, 0, 0, -face.radius * 0.72); pop()
	push(); rotate(face.secondAngle); stroke(255, 90, 90);   strokeWeight(3);  line(0, face.radius * 0.12, 0, -face.radius * 0.8); pop()
	noStroke(); fill(255); circle(0, 0, 18)
}
