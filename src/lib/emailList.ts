import type { Db } from 'mongodb';

type ClerkUser = {
  email_addresses?: { email_address: string }[];
};

export type EmailListEntry = {
  email: string;
  userId?: string;
  sources: string[];
};

async function getClerkUserEmail(userId: string): Promise<string | undefined> {
  const apiKey = process.env.CLERK_SECRET_KEY;
  if (!apiKey) return undefined;

  const resp = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) return undefined;

  const clerkUser = (await resp.json()) as ClerkUser;
  return clerkUser?.email_addresses?.[0]?.email_address;
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return null;
  return trimmed;
}

function addEmail(
  map: Map<string, EmailListEntry>,
  email: unknown,
  source: string,
  userId?: string,
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const existing = map.get(normalized);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    if (!existing.userId && userId) existing.userId = userId;
    return;
  }

  map.set(normalized, {
    email: normalized,
    userId,
    sources: [source],
  });
}

/**
 * Collect unique recipient emails for StatePulse broadcasts.
 * Sources: topic subscriptions, notification prefs (resolved via Clerk/users), users collection.
 */
export async function collectEmailList(db: Db): Promise<EmailListEntry[]> {
  const map = new Map<string, EmailListEntry>();
  const subsCol = db.collection('topic_subscriptions');
  const usersCol = db.collection('users');
  const prefsCol = db.collection('user_notification_preferences');

  const subs = await subsCol
    .find({
      $or: [
        { notifyByEmail: true },
        { email: { $exists: true, $nin: [null, ''] } },
      ],
    })
    .project({ userId: 1, email: 1, notifyByEmail: 1 })
    .toArray();

  const userIdsNeedingLookup = new Set<string>();

  for (const sub of subs) {
    if (sub.email) {
      addEmail(map, sub.email, 'topic_subscriptions', sub.userId);
    } else if (sub.userId && sub.notifyByEmail) {
      userIdsNeedingLookup.add(sub.userId);
    }
  }

  const prefs = await prefsCol
    .find({
      $or: [
        { 'emailNotifications.weeklyDigest': true },
        { 'emailNotifications.sponsorshipAlerts': { $ne: false } },
      ],
    })
    .project({ userId: 1 })
    .toArray();

  for (const pref of prefs) {
    if (pref.userId) userIdsNeedingLookup.add(pref.userId);
  }

  const users = await usersCol
    .find({
      $or: [
        { email: { $exists: true, $nin: [null, ''] } },
        { emailAddress: { $exists: true, $nin: [null, ''] } },
      ],
    })
    .project({ id: 1, clerkId: 1, email: 1, emailAddress: 1 })
    .toArray();

  for (const user of users) {
    const userId = user.clerkId || user.id;
    addEmail(map, user.emailAddress || user.email, 'users', userId);
  }

  for (const userId of userIdsNeedingLookup) {
    // Skip if we already have an email for this userId
    const alreadyHave = [...map.values()].some((e) => e.userId === userId);
    if (alreadyHave) continue;

    let email: string | undefined;
    try {
      email = await getClerkUserEmail(userId);
      if (email) {
        addEmail(map, email, 'clerk', userId);
        continue;
      }
    } catch {
      // ignore
    }

    const userDoc = await usersCol.findOne({
      $or: [{ id: userId }, { clerkId: userId }],
    });
    if (userDoc) {
      addEmail(
        map,
        userDoc.emailAddress || userDoc.email,
        'users',
        userId,
      );
    }
  }

  return [...map.values()].sort((a, b) => a.email.localeCompare(b.email));
}

/** Owner account allowed to send broadcast emails from the admin UI. */
export const BROADCAST_ADMIN_EMAILS = (
  process.env.BROADCAST_ADMIN_EMAILS || 'timberlake2025@gmail.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isBroadcastAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return BROADCAST_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
