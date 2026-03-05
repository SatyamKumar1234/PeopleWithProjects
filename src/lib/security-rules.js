// Firebase Security Rules Templates for PeopleWithProjects
// Copy these to your Firebase Console

// ======= FIRESTORE RULES =======
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users — only owner can read/write their own doc
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Projects — only members can read/write
    match /projects/{projectId} {
      allow read: if request.auth != null
        && request.auth.uid in resource.data.memberIds;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && request.auth.uid in resource.data.memberIds;

      // Files subcollection
      match /files/{fileId} {
        allow read, write: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.memberIds;
      }

      // Permissions subcollection
      match /permissions/{permId} {
        allow read, write: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.memberIds;
      }

      // Chat subcollection
      match /chat/{messageId} {
        allow read: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.memberIds;
        allow create: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.memberIds;
        allow delete: if request.auth != null
          && request.auth.uid == resource.data.userId;
      }

      // Snapshots subcollection
      match /snapshots/{snapshotId} {
        allow read, write: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.memberIds;
      }
    }

    // Invites
    match /invites/{inviteId} {
      allow read: if request.auth != null
        && (request.auth.token.email == resource.data.invitedEmail
            || request.auth.uid == resource.data.invitedBy);
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && request.auth.token.email == resource.data.invitedEmail;
      allow delete: if request.auth != null
        && request.auth.uid == resource.data.invitedBy;
    }

    // Honeypot logs — write-only (no read from client)
    match /honeypot_logs/{logId} {
      allow create: if true; // Allow anonymous writes for logging
      allow read, update, delete: if false; // Admin only via console
    }
  }
}
*/

// ======= REALTIME DATABASE RULES =======
/*
{
  "rules": {
    "presence": {
      "$projectId": {
        "$userId": {
          ".read": "auth != null",
          ".write": "auth.uid === $userId"
        }
      }
    },
    "cursors": {
      "$projectId": {
        "$userId": {
          ".read": "auth != null",
          ".write": "auth.uid === $userId"
        }
      }
    }
  }
}
*/

// ======= STORAGE RULES =======
/*
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /projects/{projectId}/{allPaths=**} {
      allow read, write: if request.auth != null;
      // For tighter security, check memberIds via Firestore (requires Cloud Functions)
    }
  }
}
*/
