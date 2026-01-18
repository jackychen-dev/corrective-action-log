"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ImportModal } from "@/components/import-modal";
import { AddLogModal } from "@/components/add-log-modal";
import { LoginScreen } from "@/components/login-screen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CorrectiveActionRecord } from "@/lib/types";
import {
  Upload,
  Download,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Edit3,
  Filter,
  ChevronDown,
  Info,
  XCircle,
} from "lucide-react";
import { formatDateForExport } from "@/lib/utils";
import * as XLSX from "xlsx";

type DirtyState = Map<
  string,
  {
    fields: Map<string, any>;
    originalUpdatedAt?: string;
  }
>;

const STORAGE_KEY = "correctiveActionRecords";

// Helper to load from localStorage
function loadRecords(): CorrectiveActionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading records:", error);
  }
  return [];
}

// Helper to save to localStorage
function saveRecords(records: CorrectiveActionRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error("Error saving records:", error);
  }
}

// Generate Internal CAR number
function generateInternalCarNumber(records: CorrectiveActionRecord[]): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const existingNumbers = records
    .map((r) => r.internalCarNumber)
    .filter((num) => num && num.startsWith(year))
    .map((num) => {
      const parts = num.split("-");
      return parts.length > 1 ? parseInt(parts[1]) : 0;
    });
  
  const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNum = maxNum + 1;
  return `${year}-${nextNum.toString().padStart(3, "0")}`;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [records, setRecords] = useState<CorrectiveActionRecord[]>([]);
  const [dirtyState, setDirtyState] = useState<DirtyState>(new Map());
  const [loading, setLoading] = useState(true);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [conflicts, setConflicts] = useState<
    { id: string; message: string }[]
  >([]);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [showSuggestions, setShowSuggestions] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [detailsColumn, setDetailsColumn] = useState<string | null>(null);
  const [showFullDetail, setShowFullDetail] = useState(false);
  const [addLogModalOpen, setAddLogModalOpen] = useState(false);
  const [newCarNumber, setNewCarNumber] = useState("");
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [freezeFirstColumn, setFreezeFirstColumn] = useState(false);

  // Column definitions
  const columnLabels: Record<string, string> = {
    internalCarNumber: "Internal CAR #",
    location: "Location",
    status: "Status",
    incidenceType: "Incidence Type",
    type: "Type",
    category: "Category",
    receivedDate: "Received Date",
    partNumber: "Part Number",
    partDescription: "Part Description",
    partFamily: "Part Family",
    customerCarNumber: "Cust. CAR #",
    stopTagNumber: "Stop Tag #",
    auditNcNumber: "Audit NC #",
    customer: "Customer",
    komatsuTracking: "Komatsu Tracking",
    workOrderNumber: "Work Order #",
    manufactureDate: "Manufacture Date",
    quantity: "Quantity",
    problemDescription: "Problem Description",
    departmentResponsible: "Department Responsible",
    defectCategory: "Defect Category",
    champion: "Champion",
    containmentComplete: "Containment Complete?",
    correctiveActionPrevention: "Corrective Action Prevention",
    correctiveActionDetection: "Corrective Action Detection",
    proposedCost: "Proposed Cost",
    costApproved: "Cost Approved?",
    initialResp: "Initial Resp.",
    finalRespDueDate: "Final Resp. Due Date",
    completedRespActual: "Completed Resp. Actual",
    daysToClose: "# Days to Close",
    closedDate: "Closed Date",
    employeeId: "Employee ID",
    rmaNumber: "RMA #",
    followUpContact: "Contact",
    followUpDebitCost: "Debit Cost",
    followUpComments: "Comments",
  };

  // Check authentication on mount
  useEffect(() => {
    const authenticated = sessionStorage.getItem("authenticated") === "true";
    setIsAuthenticated(authenticated);
  }, []);

  // Load records from localStorage
  useEffect(() => {
    if (isAuthenticated) {
      const loaded = loadRecords();
      setRecords(loaded.sort((a, b) => {
        if (a.internalCarNumber && b.internalCarNumber) {
          return a.internalCarNumber.localeCompare(b.internalCarNumber);
        }
        return 0;
      }));
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Track dirty state
  const markDirty = useCallback(
    (id: string, field: string, value: any) => {
      setDirtyState((prev) => {
        const newState = new Map(prev);
        if (!newState.has(id)) {
          const record = records.find((r) => r.id === id);
          const originalUpdatedAt = record?.updatedAt
            ? typeof record.updatedAt === "string"
              ? record.updatedAt
              : new Date().toISOString()
            : undefined;

          newState.set(id, {
            fields: new Map(),
            originalUpdatedAt,
          });
        }
        const state = newState.get(id)!;
        state.fields.set(field, value);
        return newState;
      });
    },
    [records]
  );

  const hasUnsavedChanges = dirtyState.size > 0;

  // Handle field edit
  const handleFieldEdit = (
    id: string,
    field: string,
    value: any
  ) => {
    markDirty(id, field, value);
  };

  // Get current value (from dirty state or record)
  const getCurrentValue = (record: CorrectiveActionRecord, field: string) => {
    const dirty = dirtyState.get(record.id!);
    if (dirty?.fields.has(field)) {
      return dirty.fields.get(field);
    }
    return (record as any)[field];
  };

  // Filter records based on active filters
  const filteredRecords = records.filter((record) => {
    return Object.entries(filters).every(([field, filterValue]) => {
      if (!filterValue) return true;
      const value = getCurrentValue(record, field);
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(filterValue.toLowerCase());
    });
  });

  // Save changes
  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    setSaving(true);
    setConflicts([]);
    setSaveSuccess(false);

    // Apply changes to records
    const updatedRecords = [...records];
    dirtyState.forEach((state, id) => {
      const index = updatedRecords.findIndex((r) => r.id === id);
      if (index !== -1) {
        const record = { ...updatedRecords[index] };
        state.fields.forEach((value, field) => {
          (record as any)[field] = value;
        });
        record.updatedAt = new Date().toISOString();
        updatedRecords[index] = record;
      }
    });

    // Save to localStorage
    saveRecords(updatedRecords);
    setRecords(updatedRecords);
    
    // Clear dirty state
    setDirtyState(new Map());
    setSaving(false);
    setSaveSuccess(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Discard changes
  const handleDiscard = () => {
    setDirtyState(new Map());
    setConflicts([]);
  };

  // Add new log - open modal with generated CAR number
  const handleAddNewLog = () => {
    const carNumber = generateInternalCarNumber(records);
    setNewCarNumber(carNumber);
    setAddLogModalOpen(true);
  };

  // Save new log from modal
  const handleSaveNewLog = (record: CorrectiveActionRecord) => {
    const updatedRecords = [record, ...records].sort((a, b) => {
      if (a.internalCarNumber && b.internalCarNumber) {
        return a.internalCarNumber.localeCompare(b.internalCarNumber);
      }
      return 0;
    });
    saveRecords(updatedRecords);
    setRecords(updatedRecords);
    
    // Highlight the newly added record
    setRecentlyAddedId(record.id!);
    
    // Clear the highlight after 5 seconds
    setTimeout(() => {
      setRecentlyAddedId(null);
    }, 5000);
    
    // Scroll to the new record
    setTimeout(() => {
      const element = document.getElementById(`record-${record.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Handle download
  const handleDownload = async () => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => handleDownload);
      setUnsavedChangesDialogOpen(true);
      return;
    }

    try {
      // Sort records
      const sortedRecords = [...records].sort((a, b) => {
        if (a.internalCarNumber && b.internalCarNumber) {
          return a.internalCarNumber.localeCompare(b.internalCarNumber);
        }
        return 0;
      });

      // Prepare data
      const worksheetData = [
        [
          "Internal CAR #",
          "Location",
          "Status",
          "Incidence Type",
          "Type",
          "Category",
          "Received Date",
          "Part Number",
          "Part Description",
          "Part Family",
          "Cust. CAR #",
          "Stop Tag #",
          "Audit NC #",
          "Customer",
          "Komatsu Tracking",
          "Work Order #",
          "Manufacture Date",
          "Quantity",
          "Problem Description",
          "Department Responsible",
          "Defect Category",
          "Champion",
          "Containment Complete?",
          "Corrective Action Prevention",
          "Corrective Action Detection",
          "Proposed Cost",
          "Cost Approved?",
          "Initial Resp.",
          "Final Resp. Due Date",
          "Completed Resp. Actual",
          "# Days to Close",
          "Closed Date",
          "Employee ID",
          "RMA #",
          "Contact",
          "Debit Cost",
          "Comments",
        ],
      ];

      sortedRecords.forEach((record) => {
        worksheetData.push([
          record.internalCarNumber || "",
          record.location || "",
          record.status || "",
          record.incidenceType || "",
          record.type || "",
          record.category || "",
          formatDateForExport(record.receivedDate),
          record.partNumber || "",
          record.partDescription || "",
          record.partFamily || "",
          record.customerCarNumber || "",
          record.stopTagNumber || "",
          record.auditNcNumber || "",
          record.customer || "",
          record.komatsuTracking || "",
          record.workOrderNumber || "",
          formatDateForExport(record.manufactureDate),
          record.quantity || "",
          record.problemDescription || "",
          record.departmentResponsible || "",
          record.defectCategory || "",
          record.champion || "",
          record.containmentComplete === true ||
          record.containmentComplete === "Y" ||
          record.containmentComplete === "Yes"
            ? "Y"
            : "N",
          record.correctiveActionPrevention || "",
          record.correctiveActionDetection || "",
          record.proposedCost || "",
          record.costApproved === true ||
          record.costApproved === "Y" ||
          record.costApproved === "Yes"
            ? "Y"
            : "N",
          record.initialResp || "",
          formatDateForExport(record.finalRespDueDate),
          formatDateForExport(record.completedRespActual),
          record.daysToClose || "",
          formatDateForExport(record.closedDate),
          record.employeeId || "",
          record.rmaNumber || "",
          record.followUpContact || "",
          record.followUpDebitCost || "",
          record.followUpComments || "",
        ]);
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 12 },
        { wch: 40 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 35 },
        { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 22 },
        { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
        { wch: 40 },
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "CAR LOG");

      // Generate file
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `CAR LOG - Export - ${dateStr}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export log");
    }
  };

  // Handle import complete
  const handleImportComplete = () => {
    // Reload records from localStorage
    const loaded = loadRecords();
    setRecords(loaded.sort((a, b) => {
      if (a.internalCarNumber && b.internalCarNumber) {
        return a.internalCarNumber.localeCompare(b.internalCarNumber);
      }
      return 0;
    }));
    setImportModalOpen(false);
  };

  // Prevent navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Get unique values for a field for filter suggestions
  const getUniqueValues = (field: string): string[] => {
    const values = records.map((record) => {
      const value = getCurrentValue(record, field);
      return value !== null && value !== undefined ? String(value).trim() : '';
    });
    const uniqueValues = Array.from(new Set(values)).filter(v => v !== '');
    return uniqueValues.sort();
  };

  // Get default column width based on field type
  const getDefaultWidth = (field: string) => {
    // Wide columns for text-heavy fields
    if (field === 'problemDescription' || 
        field === 'correctiveActionPrevention' || 
        field === 'correctiveActionDetection' ||
        field === 'followUpComments') {
      return 400;
    }
    // Medium columns for description fields
    if (field === 'partDescription' || field === 'champion') {
      return 200;
    }
    // Narrow columns for short fields
    return 150;
  };

  // Render column header with filter
  const renderColumnHeader = (label: string, field: string, isFirstColumn = false) => {
    const hasFilter = filters[field];
    const width = columnWidths[field] || getDefaultWidth(field);
    const showSuggestionsForField = showSuggestions[field] || false;
    const uniqueValues = getUniqueValues(field);
    const filteredSuggestions = uniqueValues.filter(v => 
      v.toLowerCase().includes((filters[field] || '').toLowerCase())
    );

    return (
      <th
        className={`p-0 border-b-2 border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100 relative group ${
          isFirstColumn && freezeFirstColumn ? 'sticky left-0 z-20' : ''
        }`}
        style={{ minWidth: width, width }}
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-3 pt-3 pb-2 gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap text-xs">
              {label}
            </span>
            <Filter
              className={`h-3 w-3 ${hasFilter ? 'text-blue-600' : 'text-gray-400'} ${hasFilter ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
            />
          </div>
          <div className="px-2 pb-2 relative">
            <Input
              type="text"
              placeholder="Filter..."
              value={filters[field] || ""}
              onChange={(e) => {
                setFilters((prev) => ({
                  ...prev,
                  [field]: e.target.value,
                }));
              }}
              onFocus={() => setShowSuggestions(prev => ({ ...prev, [field]: true }))}
              onBlur={() => setTimeout(() => setShowSuggestions(prev => ({ ...prev, [field]: false })), 200)}
              className="h-7 text-xs border-gray-300 pr-7"
              onClick={(e) => e.stopPropagation()}
            />
            <ChevronDown className="absolute right-4 top-1.5 h-4 w-4 text-gray-400 pointer-events-none" />
            {showSuggestionsForField && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                {filteredSuggestions.slice(0, 50).map((value, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFilters((prev) => ({
                        ...prev,
                        [field]: value,
                      }));
                      setShowSuggestions(prev => ({ ...prev, [field]: false }));
                    }}
                  >
                    {value}
                  </div>
                ))}
                {filteredSuggestions.length > 50 && (
                  <div className="px-3 py-2 text-xs text-gray-500 italic">
                    + {filteredSuggestions.length - 50} more...
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-2 pb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDetailsColumn(field);
              }}
              className="opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-100 rounded px-2 py-1 text-xs font-medium text-blue-700 border border-blue-300 shadow-sm flex items-center gap-1 w-full justify-center"
            >
              <Info className="h-3 w-3" />
              Show More Detail
            </button>
          </div>
        </div>
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = width;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const diff = moveEvent.clientX - startX;
              const newWidth = Math.max(100, startWidth + diff);
              setColumnWidths((prev) => ({
                ...prev,
                [field]: newWidth,
              }));
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
      </th>
    );
  };

  // Render cell
  const renderCell = (record: CorrectiveActionRecord, field: string, isFirstColumn = false) => {
    const width = columnWidths[field] || getDefaultWidth(field);
    const value = getCurrentValue(record, field);
    const isDirty = dirtyState.get(record.id!)?.fields.has(field);

    // Format display value
    let displayValue = "";
    if (value !== null && value !== undefined && value !== "") {
      if (
        field.includes("Date") ||
        field === "receivedDate" ||
        field === "manufactureDate" ||
        field === "finalRespDueDate" ||
        field === "completedRespActual" ||
        field === "closedDate"
      ) {
        displayValue = formatDateForExport(value);
      } else if (
        field === "containmentComplete" ||
        field === "costApproved"
      ) {
        displayValue =
          typeof value === "boolean"
            ? value
              ? "Y"
              : "N"
            : String(value).toUpperCase() === "Y" ||
              String(value).toUpperCase() === "YES"
            ? "Y"
            : "N";
      } else if (field === "proposedCost" || field === "followUpDebitCost") {
        displayValue =
          typeof value === "number"
            ? new Intl.NumberFormat("en-CA", {
                style: "currency",
                currency: "CAD",
              }).format(value)
            : "";
      } else {
        displayValue = String(value);
      }
    }

    return (
      <td
        className={`p-3 border-b border-gray-200 relative group ${
          isDirty ? "bg-amber-50" : "bg-inherit hover:bg-gray-50"
        } transition-colors ${isFirstColumn && freezeFirstColumn ? 'sticky left-0 z-10 border-r-2 border-gray-300' : ''}`}
        style={{ minWidth: width, width }}
      >
        {showFullDetail ? (
          editMode ? (
            <textarea
              value={displayValue}
              onChange={(e) => {
                let newValue: any = e.target.value;
                // Parse based on field type
                if (
                  field.includes("Date") ||
                  field === "receivedDate" ||
                  field === "manufactureDate" ||
                  field === "finalRespDueDate" ||
                  field === "completedRespActual" ||
                  field === "closedDate"
                ) {
                  newValue = e.target.value || undefined;
                } else if (
                  field === "containmentComplete" ||
                  field === "costApproved"
                ) {
                  newValue =
                    e.target.value.toUpperCase() === "Y" ||
                    e.target.value.toUpperCase() === "YES"
                      ? true
                      : e.target.value.toUpperCase() === "N" ||
                        e.target.value.toUpperCase() === "NO"
                      ? false
                      : e.target.value;
                } else if (
                  field === "quantity" ||
                  field === "daysToClose" ||
                  field === "proposedCost" ||
                  field === "followUpDebitCost"
                ) {
                  const num = parseFloat(e.target.value);
                  newValue = isNaN(num) ? undefined : num;
                }
                handleFieldEdit(record.id!, field, newValue);
              }}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 whitespace-pre-wrap break-words min-h-[2.5rem] resize-y"
              placeholder={displayValue ? "" : "(empty)"}
            />
          ) : (
            <div className="px-2 py-2 text-sm whitespace-pre-wrap break-words min-h-[2.5rem]">
              {displayValue || <span className="text-gray-400 italic">(empty)</span>}
            </div>
          )
        ) : (
          <div className="relative">
            <Input
              type="text"
              value={displayValue}
              disabled={!editMode}
            onChange={(e) => {
              let newValue: any = e.target.value;
              // Parse based on field type
              if (
                field.includes("Date") ||
                field === "receivedDate" ||
                field === "manufactureDate" ||
                field === "finalRespDueDate" ||
                field === "completedRespActual" ||
                field === "closedDate"
              ) {
                newValue = e.target.value || undefined;
              } else if (
                field === "containmentComplete" ||
                field === "costApproved"
              ) {
                newValue =
                  e.target.value.toUpperCase() === "Y" ||
                  e.target.value.toUpperCase() === "YES"
                    ? true
                    : e.target.value.toUpperCase() === "N" ||
                      e.target.value.toUpperCase() === "NO"
                    ? false
                    : e.target.value;
              } else if (
                field === "quantity" ||
                field === "daysToClose" ||
                field === "proposedCost" ||
                field === "followUpDebitCost"
              ) {
                const num = parseFloat(e.target.value);
                newValue = isNaN(num) ? undefined : num;
              }
              handleFieldEdit(record.id!, field, newValue);
            }}
            className={`w-full border-0 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 rounded ${editMode ? 'bg-transparent' : 'bg-gray-50 cursor-not-allowed'}`}
          />
          {isDirty && (
            <div className="absolute right-1 top-1">
              <Edit3 className="h-3 w-3 text-amber-600" />
            </div>
          )}
          </div>
        )}
      </td>
    );
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                <FileSpreadsheet className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Corrective Action Log
                </h1>
                <p className="text-sm text-gray-500">Manage and track corrective actions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAddNewLog}
                className="bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 shadow-md hover:shadow-lg transition-all"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Add New Log
              </Button>
              <Button
                onClick={() => setEditMode(!editMode)}
                variant="outline"
                className={`transition-all shadow-sm ${
                  editMode
                    ? 'border-orange-300 text-orange-700 bg-orange-50'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {editMode ? 'Lock Editing' : 'Unlock Editing'}
              </Button>
              <div className="flex items-center gap-3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white">
                <label htmlFor="full-detail-toggle" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Show Full Detail
                </label>
                <Switch
                  id="full-detail-toggle"
                  checked={showFullDetail}
                  onCheckedChange={setShowFullDetail}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white">
                <label htmlFor="freeze-toggle" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Freeze First Column
                </label>
                <Switch
                  id="freeze-toggle"
                  checked={freezeFirstColumn}
                  onCheckedChange={setFreezeFirstColumn}
                />
              </div>
              <Button
                onClick={() => {
                  if (hasUnsavedChanges) {
                    setPendingNavigation(() => () => setImportModalOpen(true));
                    setUnsavedChangesDialogOpen(true);
                  } else {
                    setImportModalOpen(true);
                  }
                }}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel
              </Button>
              <Button
                onClick={handleDownload}
                variant="outline"
                disabled={loading}
                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 transition-all shadow-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Log
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saving}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                onClick={handleDiscard}
                disabled={!hasUnsavedChanges}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 transition-all shadow-sm"
              >
                <X className="h-4 w-4 mr-2" />
                Discard
              </Button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  You have <strong>{dirtyState.size}</strong> unsaved row(s) with modifications
                </span>
              </div>
            )}
            {Object.keys(filters).some(k => filters[k]) && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <Filter className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  <strong>{Object.keys(filters).filter(k => filters[k]).length}</strong> filter(s) active
                </span>
                <button
                  onClick={() => setFilters({})}
                  className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{filteredRecords.length}{Object.keys(filters).some(k => filters[k]) && <span className="text-sm text-gray-500"> / {records.length}</span>}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Modified Rows</p>
                <p className="text-2xl font-bold text-amber-600">{dirtyState.size}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <Edit3 className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Open Status</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredRecords.filter((r) => r.status?.toLowerCase() === "open").length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Closed Status</p>
                <p className="text-2xl font-bold text-purple-600">
                  {filteredRecords.filter((r) => r.status?.toLowerCase() === "closed").length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="container mx-auto px-6 pb-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-y-auto max-h-[calc(100vh-350px)]">
              <table className="w-full text-sm border-collapse table-fixed">
                <thead className="sticky top-0 z-[15]">
                  <tr>
                    {renderColumnHeader("Internal CAR #", "internalCarNumber", true)}
                    {renderColumnHeader("Location", "location")}
                    {renderColumnHeader("Status", "status")}
                    {renderColumnHeader("Incidence Type", "incidenceType")}
                    {renderColumnHeader("Type", "type")}
                    {renderColumnHeader("Category", "category")}
                    {renderColumnHeader("Received Date", "receivedDate")}
                    {renderColumnHeader("Part Number", "partNumber")}
                    {renderColumnHeader("Part Description", "partDescription")}
                    {renderColumnHeader("Part Family", "partFamily")}
                    {renderColumnHeader("Cust. CAR #", "customerCarNumber")}
                    {renderColumnHeader("Stop Tag #", "stopTagNumber")}
                    {renderColumnHeader("Audit NC #", "auditNcNumber")}
                    {renderColumnHeader("Customer", "customer")}
                    {renderColumnHeader("Komatsu Tracking", "komatsuTracking")}
                    {renderColumnHeader("Work Order #", "workOrderNumber")}
                    {renderColumnHeader("Manufacture Date", "manufactureDate")}
                    {renderColumnHeader("Quantity", "quantity")}
                    {renderColumnHeader("Problem Description", "problemDescription")}
                    {renderColumnHeader("Department Responsible", "departmentResponsible")}
                    {renderColumnHeader("Defect Category", "defectCategory")}
                    {renderColumnHeader("Champion", "champion")}
                    {renderColumnHeader("Containment Complete?", "containmentComplete")}
                    {renderColumnHeader("Corrective Action Prevention", "correctiveActionPrevention")}
                    {renderColumnHeader("Corrective Action Detection", "correctiveActionDetection")}
                    {renderColumnHeader("Proposed Cost", "proposedCost")}
                    {renderColumnHeader("Cost Approved?", "costApproved")}
                    {renderColumnHeader("Initial Resp.", "initialResp")}
                    {renderColumnHeader("Final Resp. Due Date", "finalRespDueDate")}
                    {renderColumnHeader("Completed Resp. Actual", "completedRespActual")}
                    {renderColumnHeader("# Days to Close", "daysToClose")}
                    {renderColumnHeader("Closed Date", "closedDate")}
                    {renderColumnHeader("Employee ID", "employeeId")}
                    {renderColumnHeader("RMA #", "rmaNumber")}
                    {renderColumnHeader("Contact", "followUpContact")}
                    {renderColumnHeader("Debit Cost", "followUpDebitCost")}
                    {renderColumnHeader("Comments", "followUpComments")}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, idx) => {
                    const isRowDirty = dirtyState.has(record.id!);
                    const isRecentlyAdded = record.id === recentlyAddedId;

                    return (
                      <tr
                        key={record.id}
                        id={`record-${record.id}`}
                        className={`${
                          isRecentlyAdded
                            ? "bg-green-100 border-l-4 border-green-500 animate-pulse"
                            : isRowDirty
                            ? "bg-amber-50/50"
                            : idx % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50/50"
                        } hover:bg-blue-50/30 transition-colors`}
                      >
                        {renderCell(record, "internalCarNumber", true)}
                        {renderCell(record, "location")}
                        {renderCell(record, "status")}
                        {renderCell(record, "incidenceType")}
                        {renderCell(record, "type")}
                        {renderCell(record, "category")}
                        {renderCell(record, "receivedDate")}
                        {renderCell(record, "partNumber")}
                        {renderCell(record, "partDescription")}
                        {renderCell(record, "partFamily")}
                        {renderCell(record, "customerCarNumber")}
                        {renderCell(record, "stopTagNumber")}
                        {renderCell(record, "auditNcNumber")}
                        {renderCell(record, "customer")}
                        {renderCell(record, "komatsuTracking")}
                        {renderCell(record, "workOrderNumber")}
                        {renderCell(record, "manufactureDate")}
                        {renderCell(record, "quantity")}
                        {renderCell(record, "problemDescription")}
                        {renderCell(record, "departmentResponsible")}
                        {renderCell(record, "defectCategory")}
                        {renderCell(record, "champion")}
                        {renderCell(record, "containmentComplete")}
                        {renderCell(record, "correctiveActionPrevention")}
                        {renderCell(record, "correctiveActionDetection")}
                        {renderCell(record, "proposedCost")}
                        {renderCell(record, "costApproved")}
                        {renderCell(record, "initialResp")}
                        {renderCell(record, "finalRespDueDate")}
                        {renderCell(record, "completedRespActual")}
                        {renderCell(record, "daysToClose")}
                        {renderCell(record, "closedDate")}
                        {renderCell(record, "employeeId")}
                        {renderCell(record, "rmaNumber")}
                        {renderCell(record, "followUpContact")}
                        {renderCell(record, "followUpDebitCost")}
                        {renderCell(record, "followUpComments")}
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && records.length > 0 && (
                    <tr>
                      <td colSpan={37} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Filter className="h-16 w-16 text-gray-300" />
                          <p className="text-gray-500 text-lg">No records match your filters</p>
                          <p className="text-gray-400 text-sm">Try adjusting your filters</p>
                          <Button
                            onClick={() => setFilters({})}
                            variant="outline"
                            className="mt-2"
                          >
                            Clear All Filters
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={37} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <FileSpreadsheet className="h-16 w-16 text-gray-300" />
                          <p className="text-gray-500 text-lg">No records found</p>
                          <p className="text-gray-400 text-sm">Upload an Excel file to get started</p>
                          <Button
                            onClick={() => setImportModalOpen(true)}
                            className="mt-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Excel File
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImportComplete={handleImportComplete}
      />

      {/* Add Log Modal */}
      <AddLogModal
        open={addLogModalOpen}
        onOpenChange={setAddLogModalOpen}
        onSave={handleSaveNewLog}
        newCarNumber={newCarNumber}
      />

      {/* Column Details Dialog */}
      <AlertDialog open={!!detailsColumn} onOpenChange={(open) => !open && setDetailsColumn(null)}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-between">
              <span>
                Column Details: {detailsColumn && columnLabels[detailsColumn]}
              </span>
              <button
                onClick={() => setDetailsColumn(null)}
                className="hover:bg-gray-100 rounded p-1"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-2 overflow-hidden">
              {detailsColumn && (() => {
                const uniqueVals = Array.from(
                  new Set(
                    records
                      .map((r) => getCurrentValue(r, detailsColumn))
                      .filter((v) => v !== null && v !== undefined && v !== '')
                  )
                ).sort((a, b) => String(a).localeCompare(String(b)));

                const valueCounts = new Map<any, number>();
                records.forEach((r) => {
                  const val = getCurrentValue(r, detailsColumn);
                  if (val !== null && val !== undefined && val !== '') {
                    valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
                  }
                });

                return (
                  <>
                    <div className="text-sm font-semibold text-gray-700 py-2 border-b">
                      Total unique values: {uniqueVals.length} | Total entries: {records.filter(r => {
                        const v = getCurrentValue(r, detailsColumn);
                        return v !== null && v !== undefined && v !== '';
                      }).length}
                    </div>
                    <div className="overflow-y-auto max-h-[50vh] border rounded-md bg-gray-50">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-200 border-b">
                          <tr>
                            <th className="text-left p-2 font-semibold">#</th>
                            <th className="text-left p-2 font-semibold">Value</th>
                            <th className="text-right p-2 font-semibold">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uniqueVals.map((val, idx) => (
                            <tr
                              key={idx}
                              className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-blue-50 cursor-pointer`}
                              onClick={() => {
                                setFilters((prev) => ({
                                  ...prev,
                                  [detailsColumn]: String(val),
                                }));
                                setDetailsColumn(null);
                              }}
                            >
                              <td className="p-2 text-gray-500">{idx + 1}</td>
                              <td className="p-2 break-words">{String(val)}</td>
                              <td className="p-2 text-right text-gray-600 font-medium">
                                {valueCounts.get(val)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-xs text-gray-500 italic pt-2">
                      Click on any value to filter by it
                    </div>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={unsavedChangesDialogOpen} onOpenChange={setUnsavedChangesDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save them before continuing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingNavigation(null);
                setUnsavedChangesDialogOpen(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                handleDiscard();
                setUnsavedChangesDialogOpen(false);
                if (pendingNavigation) {
                  pendingNavigation();
                  setPendingNavigation(null);
                }
              }}
            >
              Discard
            </Button>
            <AlertDialogAction
              onClick={async () => {
                await handleSave();
                setUnsavedChangesDialogOpen(false);
                if (pendingNavigation) {
                  pendingNavigation();
                  setPendingNavigation(null);
                }
              }}
            >
              Save & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conflict Dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conflict Detected</AlertDialogTitle>
            <AlertDialogDescription>
              Some records were modified. Please reload the page to see the latest changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {conflicts.length > 0 && (
            <div className="max-h-48 overflow-auto">
              <ul className="text-sm space-y-1">
                {conflicts.map((c) => (
                  <li key={c.id} className="text-muted-foreground">
                    CAR #{records.find((r) => r.id === c.id)?.internalCarNumber || c.id}: {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => window.location.reload()}>
              Reload Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
