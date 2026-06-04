import { useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { bulkUploadProducts } from "../lib/api";

const TEMPLATE_CSV = `name,description,sku,barcode
Widget A,A small widget,SKU-001,BAR-001
Widget A,,SKU-002,BAR-002
Widget B,A larger widget,SKU-003,BAR-003
`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkUploadProductsPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: { row: number; reason: string }[];
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (user?.role !== "owner") {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <p className="font-medium">Access denied. Owner role required.</p>
        </div>
      </div>
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResult(null);
    setUploadError(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setLoading(true);
    setResult(null);
    setUploadError(null);
    try {
      const data = await bulkUploadProducts(selectedFile);
      setResult(data);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bulk Upload Products
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload a CSV file to create multiple products at once.
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">CSV File</h2>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Download template
            </button>
          </div>

          <p className="text-sm text-gray-500">
            Columns: <br />
            <code className="font-mono bg-gray-100 px-1 rounded">name</code>
            (required)
            <br />
            <code className="font-mono bg-gray-100 px-1 rounded">
              description
            </code>
            <br />
            <code className="font-mono bg-gray-100 px-1 rounded">sku</code>(required)
            <br />
            <code className="font-mono bg-gray-100 px-1 rounded">barcode</code>
            <br />
            Rows with the same name are grouped into one product.
          </p>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 text-sm">
            {uploadError}
          </div>
        )}

        {result && (
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Result</h2>
            <div className="flex gap-6 text-sm">
              <div className="flex flex-col items-center bg-green-50 rounded-lg px-6 py-3">
                <span className="text-2xl font-bold text-green-700">
                  {result.created}
                </span>
                <span className="text-green-800">Created</span>
              </div>
              <div className="flex flex-col items-center bg-amber-50 rounded-lg px-6 py-3">
                <span className="text-2xl font-bold text-amber-700">
                  {result.skipped}
                </span>
                <span className="text-amber-800">Skipped</span>
              </div>
              <div className="flex flex-col items-center bg-red-50 rounded-lg px-6 py-3">
                <span className="text-2xl font-bold text-red-700">
                  {result.errors.length}
                </span>
                <span className="text-red-800">Errors</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Error details
                </h3>
                <table className="w-full text-sm border border-gray-200 rounded overflow-hidden">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Row</th>
                      <th className="text-left px-4 py-2 font-medium">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr
                        key={i}
                        className="border-t border-gray-100 odd:bg-white even:bg-gray-50"
                      >
                        <td className="px-4 py-2 font-mono">{err.row}</td>
                        <td className="px-4 py-2 text-red-700">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
