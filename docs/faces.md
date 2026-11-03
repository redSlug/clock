# Writing a face

Open the editor at https://clock.recurse.com/editor. Click **+ New face** on the home page and you get working example code (`setup()` and `draw()` already written) next to a live round preview. Edit, watch the preview, then Save. The preview runs in the same sandbox as the display. Signing in is only needed to save.

**Who can do what** (any signed-in Recurse user):
- upload a face, and edit their own faces;
- **pause** (⏸) or resume any face. A paused face stays saved but is skipped by the display rotation;
- **delete** any face. This is permanent and affects everyone.

A face is one p5.js sketch for a round display. The theme is a clock, but a face can be anything. Using time is optional: a face that ignores it is still valid.

The display page gives every sketch a global `face` object. It is always up to date, so just read it in `draw()`.

| Property | Meaning |
| --- | --- |
| `face.size` | Canvas width and height in pixels. The canvas is square, and the round display is the circle inside it. |
| `face.radius` | `face.size / 2`. |
| `face.hours` | 0 to 23. |
| `face.minutes` | 0 to 59. |
| `face.seconds` | 0 to 59. |
| `face.hourAngle` | Hour hand angle in radians. 0 is 12 o'clock and it grows clockwise. Moves smoothly with the minutes. |
| `face.minuteAngle` | Minute hand angle, same rules. |
| `face.secondAngle` | Second hand angle, same rules. |

Example: a clock with two hands. At 6 p.m. the hour hand points straight down and the minute hand points straight up.

```js
function setup() {
  createCanvas(face.size, face.size);
}

function draw() {
  background(0);
  translate(face.radius, face.radius);
  stroke(255);
  noFill();
  circle(0, 0, face.size - 4);

  push(); rotate(face.hourAngle);   strokeWeight(8); line(0, 0, 0, -face.radius * 0.5); pop();
  push(); rotate(face.minuteAngle); strokeWeight(4); line(0, 0, 0, -face.radius * 0.8); pop();
}
```

How this is implemented is in the [design doc](design.md#face-contract).
