import { useState } from "react";
import Papa from "papaparse";
import Button from "./Button";

function extractFileIdAndGid(urlOrId) {
  if (!urlOrId) return null;
  // If user pasted plain file id
  if (/^[a-zA-Z0-9-_]+$/.test(urlOrId)) {
    return { fileId: urlOrId, gid: "0" };
  }
  // Try to extract /d/<id>/ and gid query or hash
  const idMatch = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch =
    urlOrId.match(/[?&]gid=(\d+)/) || urlOrId.match(/#gid=(\d+)/);
  if (!idMatch) return null;
  return { fileId: idMatch[1], gid: gidMatch ? gidMatch[1] : "0" };
}

export default function ImportGoogleSheet({ setProgress, setRowData }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildExportUrl = ({ fileId, gid }) =>
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=${gid}`;

  const handleImport = async () => {
    setError(null);
    const parsed = extractFileIdAndGid(input.trim());
    if (!parsed) {
      setError("Invalid link or ID to Google Sheets.");
      return;
    }

    const csvUrl = buildExportUrl(parsed);

    setLoading(true);
    try {
      const res = await fetch(csvUrl, { method: "GET" });

      if (!res.ok) {
        // Helpful error messages
        if (res.status === 403 || res.status === 401) {
          setError(
            "Sharing settings prevent access (403). Make the document public or 'Anyone with the link can view', or use 'Publish to web'.",
          );
        } else {
          setError(`Download failed: HTTP ${res.status}`);
        }
        setLoading(false);
        return;
      }

      const csvText = await res.text();

      // Parse CSV robustly using PapaParse
      const parsedCsv = Papa.parse(csvText, {
        skipEmptyLines: true,
      });

      if (parsedCsv.errors && parsedCsv.errors.length > 0) {
        console.error("PapaParse errors:", parsedCsv.errors);
        setError("Error parsing CSV.");
        setLoading(false);
        return;
      }

      const rows = parsedCsv.data; // array of arrays

      // Convert rows (array of arrays) to your { Column_1: val, ... } format
      const formatted = rows.map((row) => {
        const obj = {};
        row.forEach((cell, i) => {
          obj[`Column_${i + 1}`] = cell;
        });
        return obj;
      });

      setRowData(formatted);
      setProgress("editTable");
    } catch (err) {
      console.error(err);
      // CORS is a common issue: fetch may fail silently or throw
      setError(
        "Could not retrieve Google Sheet. Possible causes: CORS blocking in browser or document is not shared. Try 'Publish to web' or use a server-side proxy.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl bg-white p-6 shadow-md">
      <h2 className="text-center text-2xl font-semibold">
        Import Google Sheet
      </h2>

      <input
        type="text"
        placeholder="Paste full link or just fileId (e.g. 1AbC... )"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setError(null);
        }}
        className="rounded-lg border bg-gray-50 p-3"
      />

      <p className="text-sm text-gray-500">
        * Use shared link 'Anyone with link can view' or 'Publish to web' if
        CORS blocks fetch.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button clickHandler={() => setInput("")}>Clean</Button>
        <Button clickHandler={handleImport} className="ml-auto">
          {loading ? "Importing..." : "Importing"}
        </Button>
      </div>
    </div>
  );
}
