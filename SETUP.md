# Quick Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Create `.env.local` file with your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 3. Deploy Firestore Rules

Upload `firestore.rules` to Firebase Console:
- Go to Firebase Console > Firestore Database > Rules
- Copy contents of `firestore.rules`
- Deploy

## 4. Create Firestore Indexes

Upload `firestore.indexes.json` to Firebase Console:
- Go to Firebase Console > Firestore Database > Indexes
- Create composite index for `correctiveActions` collection on `internalCarNumber` (ascending)

## 5. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Features Implemented

✅ Excel Import with validation (file name must contain "CAR LOG")
✅ Excel Export (downloads all records as .xlsx)
✅ Explicit Save/Discard buttons
✅ Dirty tracking (yellow highlight for modified cells/rows)
✅ Conflict detection (warns when records modified by another user)
✅ Unsaved changes warning (prevents navigation with unsaved changes)
✅ Real-time updates (Firestore listener)
✅ Auto CAR # generation (YY-NNN format)
✅ Batch processing (200 rows per batch for imports)
✅ Large file support (handles 2000+ rows efficiently)

## File Structure

- `app/page.tsx` - Main application page with data table
- `app/api/import-excel/route.ts` - Excel import endpoint
- `app/api/export-excel/route.ts` - Excel export endpoint
- `app/api/corrective-actions/bulk/route.ts` - Bulk update endpoint
- `components/import-modal.tsx` - Excel import modal component
- `lib/excel-parser.ts` - Excel file parsing logic
- `lib/excel-mapper.ts` - Excel-to-DB field mapping
- `lib/firestore-helpers.ts` - Firestore operations
- `lib/types.ts` - TypeScript type definitions

## Next Steps

1. Set up Firebase Authentication (if needed)
2. Deploy to production (Vercel, Firebase Hosting, etc.)
3. Configure Firestore security rules for your auth requirements
4. Test import/export with your actual Excel files

