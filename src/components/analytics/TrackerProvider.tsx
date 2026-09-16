'use client';

export function trackClientEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  try {
    if (typeof window === 'undefined') return;

    const detail = {
      eventName,
      properties: properties || {},
      timestamp: new Date().toISOString(),
    };

    window.dispatchEvent(
      new CustomEvent('ilma:analytics', {
        detail,
      })
    );

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[ILMA Analytics]', detail);
    }
  } catch {
    // Analytics must never break the storefront.
  }
}

export default function TrackerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}