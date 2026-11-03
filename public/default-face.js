// Built-in fallback clock. The display shows this when the API has no faces yet or can't be reached at startup.
function setup() {
	createCanvas(face.size, face.size)
}
function draw() {
	background(0)
	translate(face.radius, face.radius)
	stroke(255)
	noFill()
	strokeWeight(3)
	circle(0, 0, face.size - 6)
	push(); rotate(face.hourAngle); strokeWeight(10); line(0, 0, 0, -face.radius * 0.5); pop()
	push(); rotate(face.minuteAngle); strokeWeight(5); line(0, 0, 0, -face.radius * 0.8); pop()
}
