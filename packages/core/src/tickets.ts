/** Help desk rules shared by the customer pages, Admin and the server. */
import { z } from "zod";
import { indianMobile } from "./checkout-schema.ts";

export const TICKET_CATEGORIES = ["order", "subscription", "payment", "delivery", "food", "feedback", "other"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  order: "An order",
  subscription: "My subscription",
  payment: "Payment or refund",
  delivery: "Delivery",
  food: "Food or allergies",
  feedback: "Feedback",
  other: "Something else",
};

export const TICKET_STATUSES = ["open", "waiting", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Needs a reply",
  waiting: "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
};
/** What the customer sees, in their words. */
export const CUSTOMER_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "We're on it",
  waiting: "We replied",
  resolved: "Resolved",
  closed: "Closed",
};

const NEXT: Record<TicketStatus, TicketStatus[]> = {
  open: ["waiting", "resolved", "closed"],
  waiting: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};
export const canSetStatus = (from: TicketStatus, to: TicketStatus) => NEXT[from].includes(to);

/** A customer writing again reopens anything that isn't closed for good; a closed ticket stays closed. */
export const statusAfterCustomerReply = (s: TicketStatus): TicketStatus | null => (s === "closed" ? null : "open");
/** A visible staff reply hands the ticket to the customer; an internal note changes nothing. */
export const statusAfterStaffReply = (s: TicketStatus, internal: boolean): TicketStatus => (internal ? s : s === "open" ? "waiting" : s);

export const MESSAGE_MAX = 2000;

export const newTicketSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  phone: indianMobile,
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(120)]),
  category: z.enum(TICKET_CATEGORIES, { message: "Pick what it's about" }),
  subject: z.string().trim().min(3, "Add a short subject").max(120),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(MESSAGE_MAX),
});
export type NewTicket = z.infer<typeof newTicketSchema>;

export const replySchema = z.string().trim().min(1, "Write a message").max(MESSAGE_MAX);
