export const incidentStatuses = ["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "REJECTED"];

export const incidentStatusHints: Record<string, string> = {
  REPORTED: "New report waiting for triage.",
  VERIFIED: "Confirmed and ready for action.",
  IN_PROGRESS: "Field response is underway.",
  RESOLVED: "Closed after response.",
  REJECTED: "Closed without action."
};

export const getNextIncidentStatuses = (status: string) => {
  switch (status) {
    case "REPORTED":
      return ["VERIFIED", "REJECTED"];
    case "VERIFIED":
      return ["IN_PROGRESS", "REJECTED", "REPORTED"];
    case "IN_PROGRESS":
      return ["RESOLVED", "REJECTED", "VERIFIED"];
    case "RESOLVED":
    case "REJECTED":
      return ["REPORTED"];
    default:
      return incidentStatuses.filter((nextStatus) => nextStatus !== status);
  }
};
