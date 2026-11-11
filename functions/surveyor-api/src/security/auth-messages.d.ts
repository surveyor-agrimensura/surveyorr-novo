export function passwordResetRequestMessage(maskedEmail: unknown): string;
export function attemptPasswordResetDelivery(deliver: () => Promise<unknown>, onFailure?: () => Promise<unknown>): Promise<boolean>;
export function passwordResetSubject(email: unknown, secret: string): string;
export function transientAuthBodyPayload(token: string, options: {cookieFlag: string; payloadKey: string; origin?: string; allowBodyTokenWithoutOrigin?: boolean}): Record<string, unknown>;
