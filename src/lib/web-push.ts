import webpush from 'web-push';
import prisma from '@/lib/prisma';

const publicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const privateKey =
  process.env.VAPID_PRIVATE_KEY;

const subject =
  process.env.VAPID_SUBJECT ||
  'mailto:admin@ilmahijabcollection.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  orderId?: string;
};

export async function sendPushNotification(
  payload: PushPayload
) {
  if (!publicKey || !privateKey) {
    console.warn(
      'VAPID keys are not configured.'
    );
    return;
  }

  const subscriptions =
    await prisma.pushSubscription.findMany();

  if (subscriptions.length === 0) {
    console.log(
      'No push subscriptions registered.'
    );
    return;
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url:
      payload.url ||
      '/admin/orders',
    orderId:
      payload.orderId || '',
  });

  await Promise.all(
    subscriptions.map(
      async (subscription: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,

              keys: {
                p256dh:
                  subscription.p256dh,

                auth:
                  subscription.auth,
              },
            },
            message
          );
        } catch (error: any) {
          console.error(
            'Push notification failed:',
            error
          );

          if (
            error?.statusCode === 404 ||
            error?.statusCode === 410
          ) {
            await prisma.pushSubscription
              .delete({
                where: {
                  endpoint:
                    subscription.endpoint,
                },
              })
              .catch(() => {});
          }
        }
      }
    )
  );
}