export interface ReportScreenDetail {
  installationCode: string;
  uptime: number;
  telecomOperatorName: string;
  incidentCount: number;
  coordinates: [number, number] | null; // [longitude, latitude]
}

export interface ReportRepairmanDetail {
  fullName: string;
  screensAssignedCount: number;
  totalIncidentsCount: number;
  resolvedIncidentsCount: number;
  unresolvedIncidentsCount: number;
  avgResolutionTime: string | null;
  avgAcceptanceTime: string | null; // Среднее время принятия в работу
}

export interface ReportData {
  companyName: string;
  totalScreens: number;
  uptime: number;
  totalIncidents: number;
  unresolvedIncidents: number;
  avgResolutionTime: string | null;
  screenDetails: ReportScreenDetail[];
  repairmanDetails: ReportRepairmanDetail[];
}
