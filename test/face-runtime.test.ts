import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"

type Runtime = {
	anglesFrom(h: number, m: number, s: number, ms: number): { hourAngle: number; minuteAngle: number; secondAngle: number }
	partsFromMs(ms: number, tz?: string): { hours: number; minutes: number; seconds: number; millis: number }
	parseTime(t: string): { hours: number; minutes: number; seconds: number; millis: number } | null
	createFace(c?: { size?: number; tz?: string; time?: string }): Record<string, number> & { setTime(t: string | null): void }
}
let R: Runtime
beforeAll(() => {
	new Function(readFileSync("public/runtime/face.js", "utf8"))()
	R = (globalThis as any).FaceRuntime
})

const TAU = Math.PI * 2
describe("hand angles", () => {
	it("6 p.m.: hour hand straight down, minute hand straight up", () => {
		const a = R.anglesFrom(18, 0, 0, 0)
		expect(a.hourAngle).toBeCloseTo(Math.PI)
		expect(a.minuteAngle).toBeCloseTo(0)
	})
	it("3:00 puts the hour hand a quarter turn clockwise", () => {
		expect(R.anglesFrom(3, 0, 0, 0).hourAngle).toBeCloseTo(TAU / 4)
	})
	it("hour hand moves with the minutes", () => {
		expect(R.anglesFrom(12, 30, 0, 0).hourAngle).toBeCloseTo(TAU / 24)
	})
	it("minute 15 is a quarter turn, second 30 is half a turn", () => {
		expect(R.anglesFrom(0, 15, 0, 0).minuteAngle).toBeCloseTo(TAU / 4)
		expect(R.anglesFrom(0, 0, 30, 0).secondAngle).toBeCloseTo(Math.PI)
	})
	it("seconds are smooth with milliseconds", () => {
		expect(R.anglesFrom(0, 0, 0, 500).secondAngle).toBeCloseTo(TAU / 120)
	})
})

describe("timezones", () => {
	it("reads wall time in the requested zone", () => {
		const utcNoon = Date.UTC(2026, 0, 15, 12, 0, 0)
		expect(R.partsFromMs(utcNoon, "UTC").hours).toBe(12)
		expect(R.partsFromMs(utcNoon, "America/New_York").hours).toBe(7)
		expect(R.partsFromMs(utcNoon, "Asia/Tokyo").hours).toBe(21)
	})
	it("midnight is hour 0, not 24", () => {
		expect(R.partsFromMs(Date.UTC(2026, 0, 15, 0, 0, 0), "UTC").hours).toBe(0)
	})
})

describe("parseTime", () => {
	it("accepts HH:MM and HH:MM:SS", () => {
		expect(R.parseTime("18:00")).toMatchObject({ hours: 18, minutes: 0, seconds: 0 })
		expect(R.parseTime("6:05:30")).toMatchObject({ hours: 6, minutes: 5, seconds: 30 })
	})
	it("rejects nonsense", () => {
		for (const bad of ["", "25:00", "12:60", "noon", "12", null as any]) expect(R.parseTime(bad)).toBeNull()
	})
})

describe("face object", () => {
	it("exposes size and radius", () => {
		const f = R.createFace({ size: 480 })
		expect(f.size).toBe(480)
		expect(f.radius).toBe(240)
	})
	it("a fixed time drives hours and angles; setTime(null) returns to live", () => {
		const f = R.createFace({ time: "18:00" })
		expect(f.hours).toBe(18)
		expect(f.hourAngle).toBeCloseTo(Math.PI)
		f.setTime("3:00")
		expect(f.hourAngle).toBeCloseTo(TAU / 4)
		f.setTime(null)
		expect(f.hours).toBe(new Date().getHours())
	})
})
