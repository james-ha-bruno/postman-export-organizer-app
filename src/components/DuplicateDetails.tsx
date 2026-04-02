import type { DuplicateInfo, DuplicateCollectionInfo } from "../types";

interface DuplicateDetailsProps {
  requests: DuplicateInfo;
  collections: DuplicateCollectionInfo;
}

export default function DuplicateDetails({ requests, collections }: DuplicateDetailsProps) {
  const hasRequestDupes = requests.exact_count > 0 || requests.possible_count > 0;
  const hasCollectionDupes = collections.name_duplicates.length > 0 || collections.content_duplicates.length > 0;

  if (!hasRequestDupes && !hasCollectionDupes) {
    return (
      <p className="py-2 text-sm text-gray-500 dark:text-gray-400 italic">No duplicates found</p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Request duplicates */}
      {requests.exact_count > 0 && (
        <div>
          <h5 className="mb-1 font-medium text-red-700 dark:text-red-400">
            Exact Request Duplicates ({requests.exact_count})
          </h5>
          <ul className="space-y-2">
            {requests.exact_groups.map((group) => (
              <li key={group.key} className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                <p className="mb-1 font-mono text-xs text-red-800 dark:text-red-300 break-all">{group.key}</p>
                <ul className="ml-4 list-disc space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {group.requests.map((req, i) => (
                    <li key={i}>
                      <span className="font-medium">{req.method}</span> {req.name}
                      <span className="text-gray-400 dark:text-gray-500"> in {req.collection_name}{req.folder ? ` / ${req.folder}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.possible_count > 0 && (
        <div>
          <h5 className="mb-1 font-medium text-amber-700 dark:text-amber-400">
            Possible Request Duplicates ({requests.possible_count})
          </h5>
          <ul className="space-y-2">
            {requests.possible_groups.map((group) => (
              <li key={group.key} className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                <p className="mb-1 font-mono text-xs text-amber-800 dark:text-amber-300 break-all">{group.key}</p>
                <ul className="ml-4 list-disc space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {group.requests.map((req, i) => (
                    <li key={i}>
                      <span className="font-medium">{req.method}</span> {req.name}
                      <span className="text-gray-400 dark:text-gray-500"> in {req.collection_name}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Collection duplicates */}
      {collections.name_duplicates.length > 0 && (
        <div>
          <h5 className="mb-1 font-medium text-orange-700 dark:text-orange-400">
            Collection Name Duplicates
          </h5>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {collections.name_duplicates.map((group) => (
              <li key={group.name} className="rounded bg-orange-50 p-2 dark:bg-orange-900/20">
                <span className="font-medium text-gray-800 dark:text-gray-200">{group.name}</span>
                <span className="text-gray-400"> × {group.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {collections.content_duplicates.length > 0 && (
        <div>
          <h5 className="mb-1 font-medium text-orange-700 dark:text-orange-400">
            Collection Content Duplicates
          </h5>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {collections.content_duplicates.map((group) => (
              <li key={group.signature} className="rounded bg-orange-50 p-2 dark:bg-orange-900/20">
                <span className="font-medium text-gray-800 dark:text-gray-200">{group.collection_names.join(", ")}</span>
                <span className="text-gray-400"> ({group.count} copies)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

