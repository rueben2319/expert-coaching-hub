export function isBuilderPreview() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname || "";
  const search = window.location.search || "";
  const builderGlobal = (window as any).__BUILDER_PREVIEW;
  return (
    builderGlobal === true ||
    host.includes("builder") ||
    host.includes("builder.io") ||
    search.includes("builder_preview") ||
    search.includes("builder")
  );
}
