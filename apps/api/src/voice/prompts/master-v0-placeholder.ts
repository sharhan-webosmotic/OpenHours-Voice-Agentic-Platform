/**
 * THE MASTER PROMPT, VERSION v0-placeholder. THE WORDING IS NOT FINAL.
 *
 * This file holds a placeholder. The real master prompt text is being written by the person
 * who owns the ticket and will arrive as its own version, `v1`, alongside this one. Nothing
 * here should be read as the agreed wording for what the agent says to a patient.
 *
 * WHAT IS REAL AND READY TO REVIEW is everything around the words: the template format, the
 * substitution set, what is baked in and what is deliberately left out, and the renderer
 * that fills it. Replacing this file's prose with the approved text is intended to be the
 * whole of adopting v1, and `registry.ts` explains how a version is added without disturbing
 * the clinics already pointing at an older one.
 *
 * ─── WHAT IS BAKED IN, AND WHAT MUST NEVER BE ───────────────────────────────────
 *
 * BAKED IN, for now: opening hours, services and their durations, doctors, the booking
 * policy, the clinic's address and contact details, the agent's greeting and tone, the
 * frequently asked answers, and the never-promise list. All of it changes rarely, and a
 * clinic's own staff would answer these from memory.
 *
 * NEVER BAKED IN: availability. Not which slots are free, not "we have space on Tuesday",
 * not a count of remaining appointments, not today's schedule. Those are fetched by the
 * agent through tool calls at the moment of the call, and the reason is not performance. A
 * prompt is a snapshot taken when somebody last pasted it into Sarvam. An agent that
 * answers from a snapshot will offer a slot that was taken an hour ago, and the patient
 * will arrive to find it gone. The tool endpoints that serve this arrive with the voice
 * work; until they exist, the agent must say it will check rather than claim to know.
 *
 * ALSO NEVER BAKED IN: anything about a specific patient. No names, no phone numbers, no
 * appointment history, no notes. A prompt is pasted into a provider console by hand and
 * lives in a provider's configuration, which is not a place patient data may go.
 *
 * THE BAKED SET IS EXPECTED TO SHRINK. When the tool endpoints exist, hours and services
 * can be fetched too, and should be: the same staleness argument applies to a clinic that
 * changed its Saturday hours and did not re-paste its prompt. `docs/features/pilot-clinic.md`
 * records this so the decision is revisited deliberately rather than inherited.
 */

/**
 * The template, as text with `{{placeholder}}` substitutions.
 *
 * Plain text rather than a templating dependency: the substitution set is closed and
 * declared in `registry.ts`, every value is a string the renderer has already formatted,
 * and a template engine would add a dependency plus an expression language that could
 * reach into data this file has no business reaching.
 */
export const MASTER_PROMPT_V0_PLACEHOLDER = `
[PLACEHOLDER PROMPT, VERSION v0-placeholder. NOT APPROVED WORDING.]

You are the receptionist answering the telephone for {{clinicName}}.

You book, reschedule and cancel appointments, and you answer questions about the clinic.
You never diagnose, never recommend or change a treatment or medication, and never offer
an opinion on whether a symptom is serious. If a caller asks for any of that, say that a
doctor at the clinic has to answer it and offer to book them in or take a message.

HOW TO SOUND
Tone: {{tone}}.
Languages you may speak: {{languages}}.
Open the call with: {{greeting}}

THE CLINIC
Name: {{clinicName}}
Address: {{address}}
Telephone for a human: {{clinicPhone}}
Time zone for every time you say out loud: {{timezone}}
{{mapLine}}

WHEN WE ARE OPEN
{{openingHours}}

WHAT CAN BE BOOKED
{{services}}

WHO THE CALLER CAN SEE
{{doctors}}

BOOKING RULES
{{bookingPolicy}}

WHEN THERE IS NOTHING AVAILABLE
{{fullyBookedResponse}}

WHEN TO HAND THE CALL TO A PERSON
{{escalationRules}}

WHAT YOU MUST NEVER SAY OR PROMISE
{{neverPromise}}

ANSWERS THE CLINIC WANTS GIVEN AS WRITTEN
{{faqs}}

CHECKING AVAILABILITY
You do not know which appointment slots are free. Nothing in these instructions tells you
what is available, and anything you remember from earlier in the call may already be out of
date. Never state or imply that a particular time is free. Say that you will check, use the
tools you have been given to look it up, and offer only what they return.

RECORDING
{{recording}}
`.trim();
