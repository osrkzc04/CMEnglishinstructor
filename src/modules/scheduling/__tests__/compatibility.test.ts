import { describe, it, expect } from "vitest"
import {
  buildLessonStarts,
  intersectSchedules,
  minutesToTime,
  timeToMinutes,
} from "@/modules/scheduling/compatibility"

describe("timeToMinutes / minutesToTime", () => {
  it("ida y vuelta", () => {
    expect(timeToMinutes("00:00")).toBe(0)
    expect(timeToMinutes("19:30")).toBe(1170)
    expect(minutesToTime(1170)).toBe("19:30")
    expect(minutesToTime(0)).toBe("00:00")
  })

  it("rechaza formato inválido", () => {
    expect(() => timeToMinutes("9:5")).toThrow()
    expect(() => timeToMinutes("24:00")).toThrow()
  })
})

describe("intersectSchedules", () => {
  it("devuelve la ventana exacta cuando hay coincidencia parcial", () => {
    const student = [{ dayOfWeek: 1, startTime: "18:00", endTime: "20:00" }]
    const teacher = [{ dayOfWeek: 1, startTime: "19:00", endTime: "21:00" }]
    expect(intersectSchedules(student, teacher, 45)).toEqual([
      {
        dayOfWeek: 1,
        startTime: "19:00",
        endTime: "20:00",
        durationMinutes: 60,
      },
    ])
  })

  it("descarta ventanas más cortas que la duración mínima", () => {
    const student = [{ dayOfWeek: 2, startTime: "07:00", endTime: "07:30" }]
    const teacher = [{ dayOfWeek: 2, startTime: "07:00", endTime: "07:30" }]
    expect(intersectSchedules(student, teacher, 45)).toEqual([])
  })

  it("ignora días distintos", () => {
    const student = [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }]
    const teacher = [{ dayOfWeek: 2, startTime: "09:00", endTime: "12:00" }]
    expect(intersectSchedules(student, teacher, 45)).toEqual([])
  })

  it("fusiona ventanas adyacentes del mismo día", () => {
    const student = [
      { dayOfWeek: 3, startTime: "08:00", endTime: "09:30" },
      { dayOfWeek: 3, startTime: "09:30", endTime: "11:00" },
    ]
    const teacher = [{ dayOfWeek: 3, startTime: "08:00", endTime: "11:00" }]
    const result = intersectSchedules(student, teacher, 45)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "11:00",
      durationMinutes: 180,
    })
  })

  it("ordena por día y luego por hora", () => {
    const student = [
      { dayOfWeek: 5, startTime: "18:00", endTime: "20:00" },
      { dayOfWeek: 1, startTime: "19:00", endTime: "21:00" },
    ]
    const teacher = [
      { dayOfWeek: 1, startTime: "18:00", endTime: "22:00" },
      { dayOfWeek: 5, startTime: "17:00", endTime: "21:00" },
    ]
    const result = intersectSchedules(student, teacher, 45)
    expect(result.map((r) => `${r.dayOfWeek}@${r.startTime}`)).toEqual([
      "1@19:00",
      "5@18:00",
    ])
  })
})

describe("buildLessonStarts", () => {
  it("desliza 15min y encaja la clase entera", () => {
    const opts = buildLessonStarts(
      {
        dayOfWeek: 1,
        startTime: "18:00",
        endTime: "19:30",
        durationMinutes: 90,
      },
      45,
    )
    expect(opts).toEqual([
      { startTime: "18:00", endTime: "18:45" },
      { startTime: "18:15", endTime: "19:00" },
      { startTime: "18:30", endTime: "19:15" },
      { startTime: "18:45", endTime: "19:30" },
    ])
  })

  it("retorna lista vacía si la ventana no encaja una clase", () => {
    const opts = buildLessonStarts(
      {
        dayOfWeek: 0,
        startTime: "08:00",
        endTime: "08:30",
        durationMinutes: 30,
      },
      45,
    )
    expect(opts).toEqual([])
  })
})
