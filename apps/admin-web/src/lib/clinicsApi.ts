import { createClinicsApi, type ClinicsApi } from '@clinicai/api-client';
import { apiClient } from './apiClient';

/**
 * The clinic configuration API for this console.
 *
 * Built over `apiClient.request`, which is the authenticated caller that attaches the
 * in-memory access token, recovers from one expired-token 401 and reports a lost session.
 * So there is still exactly one access token in this application and one refresh slot
 * (D-002), and nothing here knows how a session works.
 */
export const clinicsApi: ClinicsApi = createClinicsApi(apiClient.request);
