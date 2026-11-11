import { authenticatedRequest } from '../../lib/authenticatedRequest';
import type { SurveyorSession } from './authService';

export type PrivacyPreferences = {
  version: 1;
  necessary: true;
  analytics: boolean;
  personalization: boolean;
  marketing: boolean;
  updatedAt: string;
};

type PreferencesResponse = { preferences?: PrivacyPreferences | null };

async function request(
  session: SurveyorSession,
  method: 'GET' | 'PUT',
  preferences?: PrivacyPreferences
): Promise<PreferencesResponse> {
  return authenticatedRequest<PreferencesResponse>('/api/privacy/preferences', {
    method,
    accessToken: session.accessToken,
    ...(preferences ? { body: { preferences } } : {})
  });
}

export async function getPrivacyPreferences(session: SurveyorSession): Promise<PrivacyPreferences | null> {
  const response = await request(session, 'GET');
  return response.preferences || null;
}

export async function savePrivacyPreferences(session: SurveyorSession, preferences: PrivacyPreferences): Promise<PrivacyPreferences> {
  const response = await request(session, 'PUT', preferences);
  if (!response.preferences) throw new Error('A API não confirmou a gravação das preferências de privacidade.');
  return response.preferences;
}
