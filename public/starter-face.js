// A face is a p5.js sketch for a round display. The `face` object gives you the size and the time:
//   face.size, face.radius          canvas size in pixels (square; the display shows the circle inside it)
//   face.hours, face.minutes, face.seconds
//   face.hourAngle, face.minuteAngle, face.secondAngle    radians; 0 is 12 o'clock, clockwise
// Edit anything below and watch the preview on the right.

function setup() {
	createCanvas(face.size, face.size)
}

function draw() {
	background(20)
	translate(face.radius, face.radius) // put (0, 0) in the middle

	// outer ring
	noFill()
	stroke(255)
	strokeWeight(4)
	circle(0, 0, face.size - 8)

	// hour hand: rotate, then draw a line straight up
	push()
	rotate(face.hourAngle)
	strokeWeight(10)
	line(0, 0, 0, -face.radius * 0.5)
	pop()

	// minute hand
	push()
	rotate(face.minuteAngle)
	strokeWeight(5)
	line(0, 0, 0, -face.radius * 0.8)
	pop()

	// second hand
	push()
	rotate(face.secondAngle)
	stroke(255, 90, 90)
	strokeWeight(2)
	line(0, 0, 0, -face.radius * 0.85)
	pop()
}
