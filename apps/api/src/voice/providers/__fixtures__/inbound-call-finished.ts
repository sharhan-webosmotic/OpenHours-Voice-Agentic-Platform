/**
 * A recorded sample of Sarvam's inbound call-finished webhook.
 *
 * SYNTHETIC, AND BUILT FROM THE DOCUMENTED FIELD LIST in `docs/sarvam-contract.md` section 3
 * rather than from a real call, because no real call has happened yet. Every value is
 * invented: the numbers are in the Indian mobile range and belong to nobody, and the
 * `metadata.clinic_id` is a zero uuid on purpose, so a test that accidentally trusted the
 * payload's claim about which clinic this is would resolve to nothing.
 *
 * A TypeScript module rather than a `.json` file so it is type-checked and needs no
 * `resolveJsonModule`. It is still a fixture: nothing computes it.
 *
 * After the pilot call, the raw body stored in `webhook_events.payload` is the thing to
 * check this against, and to replace it with if they differ.
 */
export const inboundCallFinished = {
  app_id: 'app_fixture_0001',
  app_version: 3,
  deployment_id: 'dep_fixture_0001',
  interaction_id: '20261102/int_fixture_0001',
  user_phone_number: '+919876500001',
  agent_phone_number: '+918000000001',
  duration: 92,
  start_datetime: '2026-11-02T06:30:00.000Z',
  end_datetime: '2026-11-02T06:31:32.000Z',
  final_agent_variables: { intent: 'book' },
  output_agent_variables: { booked: 'true' },
  metadata: { clinic_id: '00000000-0000-0000-0000-000000000000' },
  interaction_transcript: [
    { role: 'assistant', en_text: 'Good morning, this is the clinic. How can I help?' },
    { role: 'user', en_text: 'I need an appointment on Tuesday.', indic_text: '...' },
    { role: 'assistant', en_text: 'There is ten thirty. Shall I book that?' },
    { role: 'user', en_text: 'Yes please.' },
  ],
} as const;
