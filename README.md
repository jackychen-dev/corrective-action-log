# Corrective Action Log Web Application

A Next.js web application for managing Corrective Action Records (CAR) with Excel import/export functionality, real-time data synchronization, and explicit save behavior with conflict detection.

## Features

- **Excel Import**: Upload .xlsx files containing CAR LOG data with validation and batch processing
- **Excel Export**: Download all records as .xlsx file with proper formatting
- **Real-time Updates**: Firestore real-time listeners for instant data synchronization
- **Explicit Save**: Edit records inline with dirty tracking and explicit save/discard buttons
- **Conflict Detection**: Warns users when records are modified by another user
- **Auto CAR Number Generation**: Automatic generation of Internal CAR # (YY-NNN format) using Firestore transactions
- **Large File Support**: Handles up to 2000+ rows efficiently with client-side parsing and server-side batch processing

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives with custom styling
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (if needed)
- **Excel Processing**: SheetJS (xlsx) for client-side parsing, ExcelJS for server-side export
- **Deployment**: Vercel, Firebase Hosting, or any Node.js hosting

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Firebase project with Firestore enabled
- Firebase Admin SDK credentials (for server-side operations)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Configure Firebase

Create a `.env.local` file in the root directory:

```env
# Client-side Firebase config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Server-side Firebase Admin config
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Firestore Security Rules

Set up Firestore security rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /correctiveActions/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /counters/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### 4. Firestore Indexes

Create a composite index in Firestore Console:

- Collection: `correctiveActions`
- Fields:
  - `internalCarNumber` (Ascending)
  
You can also create an index for:
- `internalCarNumber` (Ascending) - Single field index (recommended for queries)

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Importing Excel Files

1. Click the **"Upload CAR LOG (Excel)"** button in the toolbar
2. Select an .xlsx file (file name must contain "CAR LOG", case-insensitive)
3. Review the preview (first 10 rows)
4. Click **"Import"** to start the import process
5. Monitor progress and review the import summary:
   - **Total**: Total rows processed
   - **Created**: New records created
   - **Updated**: Existing records updated (matched by Internal CAR #)
   - **Failed**: Rows that failed to import (with error messages)

#### Excel File Format Requirements

- File name must contain "CAR LOG" (case-insensitive)
- Must be .xlsx format
- First row must contain headers
- Headers are matched by name (case-insensitive, whitespace normalized)

#### Supported Headers

The application recognizes these column headers:

- Internal CAR #
- Location
- Status
- Incidence Type
- Type
- Category
- Received Date
- Part Number
- Part Description
- Part Family
- Cust. CAR # / Customer CAR #
- Stop Tag #
- Audit NC #
- Customer
- Komatsu Tracking
- Work Order #
- Manufacture Date
- Quantity
- Problem Description
- Department Responsible
- Defect Category
- Champion
- Containment Complete? / Containment Complete
- Corrective Action Prevention
- Corrective Action Detection
- Proposed Cost
- Cost Approved? / Cost Approved
- Initial Resp. / Initial Resp
- Final Resp. Due Date
- Completed Resp. Actual
- # Days to Close / Days to Close
- Closed Date
- Employee ID
- RMA # / RMA Number
- Contact
- Debit Cost
- Comments

#### Import Behavior

- **If Internal CAR # exists**: Updates the matching record (patch update, only changed fields)
- **If Internal CAR # is missing**: Creates a new record and auto-generates Internal CAR # (YY-NNN format)
- **Duplicate detection**: If an Internal CAR # is provided but already exists, the row is marked as failed
- **Batch processing**: Rows are processed in batches of 200 to handle large files efficiently

### Exporting to Excel

1. Click the **"Download Log"** button in the toolbar
2. The application generates an .xlsx file with all records
3. File is automatically downloaded as `CAR LOG - Export - YYYY-MM-DD.xlsx`

#### Export Format

- All records sorted by Internal CAR # (ascending)
- Same column headers as import format
- Dates formatted as `yyyy-mm-dd`
- Currency fields formatted as CAD (Canadian Dollar)
- Boolean fields formatted as Y/N

### Editing Records

1. Click on any cell in the table to edit its value
2. Modified cells are highlighted in yellow
3. Modified rows have a yellow background
4. Use the toolbar buttons:
   - **"Save Changes"**: Persists all edits to the database (disabled if no changes)
   - **"Discard Changes"**: Reverts all local edits without saving (disabled if no changes)

#### Edit Behavior

- Changes are stored locally until saved
- Only modified fields are sent to the server (patch updates)
- `updatedAt` timestamp is automatically updated on save
- Conflict detection compares `updatedAt` timestamps
- If another user modified a record, you'll be warned with options to:
  - **Reload**: Refresh the page to see latest changes
  - **Overwrite**: (Currently reloads page; can be extended)

#### Data Types

- **Dates**: Format as `yyyy-mm-dd` (e.g., `2024-01-15`)
- **Booleans**: Enter `Y` or `N` (or `Yes`/`No`)
- **Numbers**: Quantity, Days to Close, Proposed Cost, Debit Cost
- **Currency**: Automatically formatted as CAD on display

### Conflict Handling

When saving, if the server detects that a record was modified after you loaded it:

1. A conflict dialog appears showing affected records
2. Click **"Reload Page"** to see the latest changes
3. Your unsaved changes for conflicted records are discarded
4. Non-conflicted records are saved successfully

## Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── import-excel/        # Excel import endpoint
│   │   ├── export-excel/        # Excel export endpoint
│   │   └── corrective-actions/
│   │       └── bulk/            # Bulk update endpoint
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main application page
├── components/
│   ├── ui/                      # Reusable UI components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── progress.tsx
│   │   └── alert-dialog.tsx
│   └── import-modal.tsx         # Excel import modal
├── lib/
│   ├── firebase.ts              # Firebase client config
│   ├── firebase-admin.ts        # Firebase Admin config
│   ├── firestore-helpers.ts     # Firestore operations
│   ├── types.ts                 # TypeScript types
│   ├── utils.ts                 # Utility functions
│   ├── excel-parser.ts          # Excel file parsing
│   └── excel-mapper.ts          # Excel-to-DB mapping
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## API Endpoints

### POST `/api/import-excel`

Imports Excel rows into Firestore.

**Request Body:**
```json
{
  "rows": [
    {
      "internalCarNumber": "24-001",
      "status": "Open",
      "partNumber": "PN123",
      ...
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "rowIndex": 0,
      "internalCarNumber": "24-001",
      "action": "created" | "updated" | "failed",
      "error": "..."
    }
  ],
  "summary": {
    "total": 100,
    "created": 50,
    "updated": 45,
    "failed": 5
  }
}
```

### GET `/api/export-excel`

Exports all records as .xlsx file.

**Response:** Excel file download

### PATCH `/api/corrective-actions/bulk`

Bulk updates records with conflict detection.

**Request Body:**
```json
{
  "patches": [
    {
      "id": "doc_id",
      "expectedUpdatedAt": "2024-01-15T10:00:00Z",
      "changes": {
        "status": "Closed",
        "closedDate": "2024-01-15"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "id": "doc_id",
      "conflict": false
    }
  ],
  "conflicts": [...]
}
```

## Internal CAR # Generation

Internal CAR numbers are auto-generated in the format `YY-NNN`:

- `YY`: Last two digits of the current year
- `NNN`: 3-digit sequence number (padded with zeros)

Example: `24-001`, `24-002`, `25-001`

The sequence is maintained per year using Firestore transactions to ensure uniqueness and prevent conflicts in concurrent scenarios.

## Development

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

All environment variables must be set for both client and server operations:

- Client variables (prefixed with `NEXT_PUBLIC_`) are exposed to the browser
- Server variables (not prefixed) are only available in API routes

### Firebase Admin Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Extract values for `.env.local`:
   - `FIREBASE_PROJECT_ID`: From project_id field
   - `FIREBASE_CLIENT_EMAIL`: From client_email field
   - `FIREBASE_PRIVATE_KEY`: From private_key field (keep quotes and \n characters)

## Troubleshooting

### Import Fails

- Verify file name contains "CAR LOG"
- Check file is .xlsx format (not .xls)
- Ensure headers are in the first row
- Check browser console for detailed errors

### Export Fails

- Verify Firestore connection
- Check server logs for errors
- Ensure sufficient memory for large exports

### Save Conflicts

- Records may have been modified by another user
- Reload the page to see latest changes
- Consider implementing optimistic locking if conflicts are frequent

### Performance Issues

- Large tables (>1000 rows) may be slow
- Consider implementing pagination or virtual scrolling
- Batch operations are optimized for 200-row chunks

## License

MIT

## Support

For issues or questions, please open an issue in the repository or contact the development team.

