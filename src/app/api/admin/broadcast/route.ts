import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Safer initialization for production/build environments
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'debatepro',
    });
  } catch (error) {
    console.warn('Firebase Admin Init Error:', error);
  }
}

export async function POST(request: Request) {
  try {
    const { title, body, secret, clickAction } = await request.json();

    if (secret !== 'nuwagabawright4105') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and Body required' }, { status: 400 });
    }

    const db = admin.firestore();
    const messaging = admin.messaging();

    const usersSnapshot = await db.collection('users')
      .where('fcmToken', '!=', '')
      .get();

    const tokens = usersSnapshot.docs.map(doc => doc.data().fcmToken);

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No devices registered' });
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        click_action: clickAction || '/notifications',
        type: 'broadcast'
      },
      webpush: {
        notification: {
          icon: '/icon.png',
          badge: '/icon.png',
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: response.successCount,
      failureCount: response.failureCount,
    });

  } catch (error: any) {
    console.error('Broadcast Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
