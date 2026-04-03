import { tool } from "@langchain/core/tools";
import { z } from "zod";

const bookAppointment = tool(
  async ({ date, time, teacher, student }) => {
    // TODO: Implement the booking logic
    return `Appointment booked for ${date} at ${time} with ${teacher} for ${student}!`;
  },
  {
    name: "book_appointment",
    description: "book a medical appointment for a given date, time, doctor and student",
    schema: z.object({
      date:    z.string().describe("The date of the appointment (YYYY-MM-DD)"),
      time:    z.string().describe("The time of the appointment (HH:MM)"),
      teacher:  z.string().describe("The name of the teacher"),
      student: z.string().describe("The name of the student"),
    }),
  }
);


const getAppointmentAvailability = tool(
  async ({ date, time, teacher }) => {
    // TODO: Implement the availability logic
    return `
    The availability slots for the ${teacher} are:
    - Monday: 10:00-15:00
    - Wednesday: 10:00-15:00
    - Thursday: 10:00-15:00
    - Friday: 10:00-12:00
    `;
  },
  {
    name: "get_appointment_availability",
    description: "get the availability of a system class for a given date, time and teacher",
    schema: z.object({
      date:   z.string().describe("The date to check availability (YYYY-MM-DD)"),
      time:   z.string().describe("The preferred time (HH:MM)"),
      teacher: z.string().describe("The name of the teacher"),
    }),
  }
);


const toolsBooking = [bookAppointment, getAppointmentAvailability];

export { toolsBooking };