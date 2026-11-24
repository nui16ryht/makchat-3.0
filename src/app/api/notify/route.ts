import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

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
    const { targetUid, title, body, clickAction, type } = await request.json();

    if (!targetUid || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = admin.firestore();
    const messaging = admin.messaging();

    const userDoc = await db.collection('users').doc(targetUid).get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      return NextResponse.json({ success: true, message: 'User has no registered device' });
    }

    await messaging.send({
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        click_action: clickAction || '/notifications',
        type: type || 'default'
      },
      webpush: {
        notification: {
          icon: '/icon.png',
          badge: '/icon.png',
        },
      },
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Notification Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
