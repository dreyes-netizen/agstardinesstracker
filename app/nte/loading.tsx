export default function NteLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-border flex-shrink-0 px-6 pt-4 pb-3">
        <div className="h-4 w-40 bg-ground rounded animate-pulse mb-1.5" />
        <div className="h-3 w-64 bg-ground rounded animate-pulse" />
      </div>
      <div className="flex-1 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-border rounded-[7px] px-4 py-3 animate-pulse">
              <div className="h-2.5 w-16 bg-ground rounded mb-2" />
              <div className="h-7 w-10 bg-ground rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white border border-border rounded-[7px] flex-1 animate-pulse h-64" />
      </div>
    </div>
  );
}
