// Minimal clock: a ring, a short hour hand and a long minute hand.
function setup() {
	createCanvas(face.size, face.size)
}

function draw() {
	background(0)
	translate(face.radius, face.radius)
	stroke(255)
	noFill()
	circle(0, 0, face.size - 4)

	push(); rotate(face.hourAngle);   strokeWeight(8); line(0, 0, 0, -face.radius * 0.5); pop()
	push(); rotate(face.minuteAngle); strokeWeight(4); line(0, 0, 0, -face.radius * 0.8); pop()
}
