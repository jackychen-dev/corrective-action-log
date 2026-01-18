"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { parseExcelFile, validateFileName } from "@/lib/excel-parser";
import { NormalizedRow, ImportResult } from "@/lib/types";
import { Upload, FileCheck, AlertCircle } from "lucide-react";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<NormalizedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    summary: {
      total: number;
      created: number;
      updated: number;
      failed: number;
    };
    results: ImportResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    console.log("File selected:", selectedFile.name, "Size:", selectedFile.size);

    // Validate file type
    if (!validateFileName(selectedFile.name)) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      setFile(null);
      setPreview([]);
      return;
    }

    setError(null);
    setFile(selectedFile);
    setResults(null);

    try {
      console.log("Starting to parse Excel file...");
      // Parse file and show preview
      const parseResult = await parseExcelFile(selectedFile);
      console.log("Parse result:", {
        rowCount: parseResult.rows.length,
        headerCount: parseResult.headers.length,
        errors: parseResult.errors
      });
      
      if (parseResult.errors.length > 0) {
        setError(`Parse errors: ${parseResult.errors.join(", ")}`);
      }

      if (parseResult.rows.length === 0) {
        setError("No data rows found in the Excel file. Please check that the file has data below the header row.");
        return;
      }

      // Show first 10 rows as preview
      setPreview(parseResult.rows.slice(0, 10));
      console.log("Preview set with", parseResult.rows.slice(0, 10).length, "rows");
    } catch (err) {
      console.error("Error parsing file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setFile(null);
      setPreview([]);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setError(null);

    try {
      // Parse file
      const parseResult = await parseExcelFile(file);
      
      if (parseResult.errors.length > 0) {
        setError(`Parse errors: ${parseResult.errors.join(", ")}`);
      }

      // Load existing records from localStorage
      const STORAGE_KEY = "correctiveActionRecords";
      let existingRecords: any[] = [];
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          existingRecords = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Error loading existing records:", e);
      }

      // Process rows locally
      const allResults: ImportResult[] = [];
      const newRecords: any[] = [];
      let currentYear = new Date().getFullYear().toString().slice(-2);
      let counter = 1;

      // Get max counter for current year
      const existingNumbers = existingRecords
        .map((r) => r.internalCarNumber)
        .filter((num) => num && num.startsWith(currentYear))
        .map((num) => {
          const parts = num.split("-");
          return parts.length > 1 ? parseInt(parts[1]) : 0;
        });
      
      if (existingNumbers.length > 0) {
        counter = Math.max(...existingNumbers) + 1;
      }

      for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        
        try {
          // Check if internalCarNumber exists
          if (row.internalCarNumber) {
            const existingIndex = existingRecords.findIndex(
              (r) => r.internalCarNumber === row.internalCarNumber
            );
            
            if (existingIndex !== -1) {
              // Update existing record
              existingRecords[existingIndex] = {
                ...existingRecords[existingIndex],
                ...row,
                updatedAt: new Date().toISOString(),
              };
              allResults.push({
                success: true,
                rowIndex: i,
                internalCarNumber: row.internalCarNumber,
                action: "updated",
              });
            } else {
              // Check for duplicate
              const duplicateIndex = newRecords.findIndex(
                (r) => r.internalCarNumber === row.internalCarNumber
              );
              if (duplicateIndex !== -1) {
                allResults.push({
                  success: false,
                  rowIndex: i,
                  action: "failed",
                  error: `Duplicate Internal CAR #: ${row.internalCarNumber}`,
                });
                continue;
              }
              
              // Create new with provided number
              const newRecord = {
                ...row,
                id: `local_${Date.now()}_${i}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              newRecords.push(newRecord);
              allResults.push({
                success: true,
                rowIndex: i,
                internalCarNumber: row.internalCarNumber,
                action: "created",
              });
            }
          } else {
            // Generate new internal CAR number
            const internalCarNumber = `${currentYear}-${counter.toString().padStart(3, "0")}`;
            counter++;
            
            const newRecord = {
              ...row,
              internalCarNumber,
              id: `local_${Date.now()}_${i}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            newRecords.push(newRecord);
            allResults.push({
              success: true,
              rowIndex: i,
              internalCarNumber,
              action: "created",
            });
          }
          
          setProgress(((i + 1) / parseResult.rows.length) * 100);
        } catch (err) {
          allResults.push({
            success: false,
            rowIndex: i,
            action: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      // Save to localStorage
      const allRecords = [...existingRecords, ...newRecords];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecords));

      const summary = {
        total: allResults.length,
        created: allResults.filter((r) => r.action === "created").length,
        updated: allResults.filter((r) => r.action === "updated").length,
        failed: allResults.filter((r) => r.action === "failed").length,
      };

      setResults({ summary, results: allResults });
      setImporting(false);
      
      // Refresh data if import was successful
      if (summary.failed === 0 || summary.created > 0 || summary.updated > 0) {
        setTimeout(() => {
          onImportComplete();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setFile(null);
      setPreview([]);
      setResults(null);
      setError(null);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Excel File</DialogTitle>
          <DialogDescription>
            Select an .xlsx file containing corrective action records. The first sheet will be imported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={importing}
              className="flex-1"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Browse
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {file && !importing && !results && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileCheck className="h-4 w-4" />
                Selected: {file.name}
              </div>
              <p className="text-sm">
                Preview (first {preview.length} rows):
              </p>
              <div className="border rounded-md overflow-auto max-h-60">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Internal CAR #</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Part Number</th>
                      <th className="p-2 text-left">Champion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.internalCarNumber || ""}</td>
                        <td className="p-2">{row.status || ""}</td>
                        <td className="p-2">{row.partNumber || ""}</td>
                        <td className="p-2">{row.champion || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleImport} className="w-full">
                Import {preview.length > 10 ? `~${file.name.includes("xlsx") ? "all" : "all"} rows` : `${preview.length} rows`}
              </Button>
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Importing... {Math.round(progress)}%
              </p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-md">
                  <div className="text-2xl font-bold">{results.summary.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-md">
                  <div className="text-2xl font-bold text-green-700">
                    {results.summary.created}
                  </div>
                  <div className="text-sm text-muted-foreground">Created</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-md">
                  <div className="text-2xl font-bold text-blue-700">
                    {results.summary.updated}
                  </div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-md">
                  <div className="text-2xl font-bold text-red-700">
                    {results.summary.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>

              {results.summary.failed > 0 && (
                <div className="border rounded-md p-4 max-h-48 overflow-auto">
                  <p className="font-semibold mb-2">Failed Rows:</p>
                  <ul className="text-sm space-y-1">
                    {results.results
                      .filter((r) => r.action === "failed")
                      .slice(0, 10)
                      .map((r, idx) => (
                        <li key={idx} className="text-destructive">
                          Row {r.rowIndex + 2}: {r.error}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

