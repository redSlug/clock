// Not a clock: a smiley that blinks once every few seconds. Faces don't have to use time.
function setup() {
	createCanvas(face.size, face.size)
}

function draw() {
	background(255, 214, 10)
	translate(face.radius, face.radius)
	const r = face.radius
	const blinking = face.seconds % 4 === 0 && (millis() % 1000) < 250

	noStroke()
	fill(30)
	if (blinking) {
		rect(-r * 0.42, -r * 0.18, r * 0.24, r * 0.05)
		rect(r * 0.18, -r * 0.18, r * 0.24, r * 0.05)
	} else {
		ellipse(-r * 0.3, -r * 0.2, r * 0.16, r * 0.24)
		ellipse(r * 0.3, -r * 0.2, r * 0.16, r * 0.24)
	}

	noFill()
	stroke(30)
	strokeWeight(r * 0.06)
	strokeCap(ROUND)
	arc(0, r * 0.05, r * 1.0, r * 0.7, 0.2, PI - 0.2)
}
