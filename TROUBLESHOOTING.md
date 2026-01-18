# Excel Import Troubleshooting

## Current Issue: "No data rows found"

The app is now logging detailed information to help debug. Follow these steps:

### Step 1: Open Browser Console
1. Press `F12` or right-click → Inspect
2. Click on the "Console" tab
3. Keep it open while uploading

### Step 2: Try Upload Again
1. Refresh the page: http://localhost:3000
2. Click "Upload Excel"
3. Select your file: `LOG-QA-05 Corrective Action Log copy Jan102026.xlsx`

### Step 3: Check Console Output

The console will show:

```
File selected: [filename] Size: [bytes]
Starting to parse Excel file...
Available sheets: [array of sheet names]
Using CAR LOG sheet: [sheet name] OR Using first sheet: [sheet name]
Sheet range: [range] Rows: [number]
Initial parse: [number] rows
Parsed [number] rows from sheet
First row sample: [data]
Found headers: [array of headers]
Mapped [number] headers to database fields
Matched: "[Excel header]" -> "[database field]"
Unmatched headers: [array]
Successfully mapped [number] rows
```

### What to Look For:

1. **"Available sheets"** - Should show "CAR LOG" in the list
2. **"Sheet range"** - Should show the actual data range (e.g., "A1:AK100")
3. **"Initial parse: X rows"** - Should be > 0
4. **"Found headers"** - Should show your column names
5. **"Matched: ..."** - Should show which headers were recognized
6. **"Unmatched headers"** - Shows headers that weren't recognized

### Common Issues:

1. **Headers not matching**: The Excel headers must match these (case-insensitive):
   - "Internal CAR #"
   - "Location"
   - "Status"
   - "Received Date"
   - etc.

2. **Empty rows at top**: If there are empty rows before the headers, the parser might skip them

3. **Merged cells**: Merged cells in the header row can cause issues

4. **Hidden rows**: Hidden rows might confuse the parser

### Next Steps:

Send me the console output (copy/paste from the Console tab) and I can tell you exactly what's wrong!

